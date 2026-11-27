"""Voice-over for a story script, with per-word timings.

    python vo.py story-reel.json out/_story-reel

For each beat it synthesises `say` (or `cap` when there is no `say`) through
an edge-tts neural voice, keeping the WordBoundary events, so the captions
can light up word by word exactly as they are spoken. Then it lays the beats
end to end, each beat lasting max(min, voice + pad), and writes:

    <out>/timeline.json   beats with absolute start/end and word times
    <out>/vo.wav          the whole voice track, 44.1 kHz stereo
"""
import asyncio
import base64
import json
import os
import re
import urllib.request
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np

FFMPEG = "C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe"
SR = 44100

story = json.load(open(sys.argv[1], encoding="utf-8"))
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
voice = story.get("voice", "en-IN-NeerjaNeural")
rate = story.get("rate", "+0%")
lead = story.get("lead", 0.3)      # visuals start this long before the voice
pad = story.get("pad", 0.5)        # breath after the voice


# VO_PROVIDER=elevenlabs (or "tts": "elevenlabs" in the script) uses
# ElevenLabs instead of edge-tts. Key: ELEVENLABS_API_KEY, or the file
# scripts/demo-video/.elevenlabs-key (never committed). Voice: ELEVEN_VOICE
# (a voice id), else the first Indian-accent voice on the account.
PROVIDER = os.environ.get("VO_PROVIDER", story.get("tts", "edge"))
_eleven = {}


def eleven_key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if k:
        return k.strip()
    f = Path(os.environ.get("ELEVENLABS_KEY_FILE", Path(__file__).resolve().parent.parent / ".elevenlabs-key"))
    if f.exists():
        return f.read_text(encoding="utf-8").strip()
    sys.exit("ElevenLabs: set ELEVENLABS_API_KEY or put the key in scripts/demo-video/.elevenlabs-key")


def eleven_voice(key):
    v = os.environ.get("ELEVEN_VOICE") or story.get("elevenVoice")
    if v:
        return v
    req = urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": key})
    voices = json.load(urllib.request.urlopen(req, timeout=60)).get("voices", [])
    def score(x):
        lab = {k: str(v).lower() for k, v in (x.get("labels") or {}).items()}
        return ("indian" in lab.get("accent", "")) * 2 + (lab.get("gender") == "female")
    voices.sort(key=score, reverse=True)
    for x in voices[:8]:
        print("  voice:", x["voice_id"], x["name"], x.get("labels"))
    if not voices:
        sys.exit("ElevenLabs: no voices on this account")
    print("using", voices[0]["name"])
    return voices[0]["voice_id"]


def synth_eleven(text, mp3):
    if "key" not in _eleven:
        _eleven["key"] = eleven_key()
        _eleven["voice"] = eleven_voice(_eleven["key"])
    model = story.get("elevenModel", "eleven_multilingual_v2")
    # v3 takes stability only as 0.0 (creative), 0.5 (natural) or 1.0 (robust)
    settings = ({"stability": story.get("elevenStability", 0.5), "similarity_boost": 0.8} if model == "eleven_v3"
                else {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True})
    body = json.dumps({"text": text, "model_id": model, "voice_settings": settings}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{_eleven['voice']}/with-timestamps?output_format=mp3_44100_128",
        data=body, headers={"xi-api-key": _eleven["key"], "content-type": "application/json"})
    for attempt in range(3):
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=180))
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if attempt == 2 or e.code not in (429, 500, 502, 503):
                sys.exit(f"ElevenLabs {e.code}: {msg}")
    with open(mp3, "wb") as f:
        f.write(base64.b64decode(resp["audio_base64"]))
    al = resp.get("alignment") or resp.get("normalized_alignment")
    # performance cues like [warmly] are directions, not words: drop them
    words, cur, t0, in_tag = [], "", None, False
    for ch, st in zip(al["characters"], al["character_start_times_seconds"]):
        if ch == "[":
            in_tag = True
            continue
        if in_tag:
            in_tag = ch != "]"
            continue
        if ch.isspace():
            if cur:
                words.append({"t": t0, "d": 0, "w": cur})
            cur, t0 = "", None
        else:
            if not cur:
                t0 = st
            cur += ch
    if cur:
        words.append({"t": t0, "d": 0, "w": cur})
    return words


async def synth(text, mp3):
    if PROVIDER == "elevenlabs":
        return synth_eleven(text, mp3)
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
    return words


def decode(mp3):
    raw = subprocess.run([FFMPEG, "-loglevel", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def norm(w):
    return re.sub(r"[^\w₹%]", "", w.lower())


def cap_words(cap):
    """Caption tokens; *word* marks the emphasised (italic serif) words."""
    toks = []
    for raw in cap.split():
        em = raw.startswith("*") or raw.endswith("*") or ("*" in raw)
        toks.append({"w": raw.replace("*", ""), "em": em})
    return toks


async def main():
    t = 0.0
    beats, track = [], []
    for i, b in enumerate(story["beats"]):
        cap = b.get("cap", "")
        say = b.get("say", cap.replace("*", ""))
        if PROVIDER == "elevenlabs" and b.get("sayPro"):
            say = b["sayPro"]  # the directed read: cues in [brackets], pauses as ...
        words, audio = [], np.zeros(0, dtype=np.float32)
        if say.strip():
            mp3 = out / f"b{i:02d}.mp3"
            words = await synth(say, mp3)
            audio = decode(mp3)
        vdur = len(audio) / SR
        dur = max(b.get("min", 2.6), (lead + vdur + pad) if vdur else 0)
        dur += b.get("extra", 0)
        start = t
        vstart = start + lead
        # map caption tokens onto spoken words: 1:1 when the counts agree,
        # proportionally when the caption writes "2,46,068" for four spoken words
        toks = cap_words(cap)
        if toks:
            if words and len(words) == len(toks):
                for tk, w in zip(toks, words):
                    tk["t"] = round(vstart + w["t"], 3)
            elif words:
                for j, tk in enumerate(toks):
                    k = min(len(words) - 1, round(j * len(words) / len(toks)))
                    tk["t"] = round(vstart + words[k]["t"], 3)
            else:
                for j, tk in enumerate(toks):
                    tk["t"] = round(start + 0.2 + j * 0.12, 3)
        beat = {k: v for k, v in b.items() if k not in ("say",)}
        beat.update({"i": i, "t0": round(start, 3), "t1": round(start + dur, 3), "vo0": round(vstart, 3),
                     "vo1": round(vstart + vdur, 3), "words": toks})
        beats.append(beat)
        track.append((vstart, audio))
        t += dur
        print(f"b{i:02d} {start:6.2f}-{start + dur:6.2f}  voice {vdur:4.1f}s  {say[:60]}")
    total = round(t + story.get("tail", 0.6), 3)
    n = int(total * SR) + SR
    mix = np.zeros(n, dtype=np.float32)
    for s, a in track:
        i0 = int(s * SR)
        mix[i0:i0 + len(a)] += a[: max(0, n - i0)]
    peak = np.max(np.abs(mix)) or 1
    mix = mix / peak * 0.89
    pcm = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
    with wave.open(str(out / "vo.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    meta = {k: v for k, v in story.items() if k != "beats"}
    meta.update({"duration": total, "beats": beats})
    json.dump(meta, open(out / "timeline.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"total {total:.1f}s -> {out / 'timeline.json'}")


asyncio.run(main())
