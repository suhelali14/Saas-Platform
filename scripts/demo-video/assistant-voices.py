"""
The voices heard *inside* the assistant's advert: a doctor telling the
assistant what to do, and a doctor and a patient in a consultation.

These are not narration. Each is written to one WAV that the capture
browser plays as its microphone, so the product hears them through the
same path a real microphone takes, and the same WAV is laid under the
picture so a viewer hears what the product heard.

  python assistant-voices.py out/_ad_assistant

Writes call.wav and consult.wav, and voices.json with where each line
starts. Voices are Microsoft neural ones through edge-tts; all the people
are made up.
"""
from __future__ import annotations
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

FFMPEG = r"C:\Users\Suhelali\OneDrive\Desktop\nayaverse-studio\node_modules\ffmpeg-static\ffmpeg.exe"
DOCTOR = "en-IN-NeerjaNeural"
PATIENT = "hi-IN-MadhurNeural"

# (voice, words, silence after it in seconds). The silences in the call
# are long enough for the assistant to answer before the next thing is
# said; it would cope with less, but a viewer needs to see each answer.
CALL = [
    (DOCTOR, "Register a new patient, Sagar Deshpande, age forty, male.", 4.0),
    (DOCTOR, "No, his age is forty five.", 4.0),
    (DOCTOR, "Yes.", 3.5),
    (DOCTOR, "Who is next?", 4.5),
]
CONSULT = [
    (DOCTOR, "Tell me, what is the problem?", 0.5),
    (PATIENT, "डॉक्टर, तीन दिन से बुखार है, और खांसी भी है।", 0.6),
    (DOCTOR, "Okay. Temperature is one hundred and one. This is a viral fever. "
             "Take paracetamol six fifty, three times a day, for three days. "
             "Get a CBC done, and come back after three days.", 1.5),
]


def duration(path: Path) -> float:
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        raise RuntimeError(f"no duration for {path}")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


async def build(name: str, lines: list[tuple[str, str, float]], out: Path, lead: float) -> list[dict]:
    parts: list[Path] = []
    marks: list[dict] = []
    at = lead
    for i, (voice, words, gap) in enumerate(lines):
        mp3 = out / f"_{name}-{i:02d}.mp3"
        await edge_tts.Communicate(words, voice=voice, rate="-4%").save(str(mp3))
        d = duration(mp3)
        marks.append({"at": round(at, 2), "duration": round(d, 2), "voice": voice, "words": words})
        parts.append(mp3)
        at += d + gap
    # One mono 48 kHz WAV: a lead of quiet, then each line and its gap.
    inputs: list[str] = []
    chain = []
    for i, p in enumerate(parts):
        inputs += ["-i", str(p)]
        chain.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur={lines[i][2]}[a{i}]")
    joined = "".join(f"[a{i}]" for i in range(len(parts)))
    graph = ";".join(chain) + f";{joined}concat=n={len(parts)}:v=0:a=1,adelay={int(lead * 1000)}[out]"
    wav = out / f"{name}.wav"
    r = subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", *inputs,
                        "-filter_complex", graph, "-map", "[out]", "-ar", "48000", "-ac", "1", str(wav)])
    if r.returncode != 0:
        raise RuntimeError(f"could not write {wav}")
    for p in parts:
        p.unlink()
    print(f"{wav.name}: {duration(wav):.1f}s")
    for m in marks:
        print(f"   {m['at']:5.1f}s  {m['words'][:70]}")
    return marks


async def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # the patient's lines are in Devanagari
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "out/_ad_assistant")
    out.mkdir(parents=True, exist_ok=True)
    # The lead is the quiet before the first word: the microphone takes a
    # moment to open, and a word spoken into that moment is lost.
    marks = {
        "call": await build("call", CALL, out, lead=1.2),
        "consult": await build("consult", CONSULT, out, lead=1.2),
    }
    (out / "voices.json").write_text(json.dumps(marks, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
