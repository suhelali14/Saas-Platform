"""
Generate narration audio for a tier ad.

Reads an ad script (ads/<tier>.md), finds the pipe-delimited table rows,
synthesises each line through Microsoft Neural voices via edge-tts, and
writes one MP3 per line to <out_dir>/line-NN.mp3 plus a manifest.json
naming the duration of each clip. The renderer reads the manifest to
place each clip at its scheduled start.

Default voice: en-IN-PrabhatNeural. Pass --voice to change (any
edge-tts voice; en-IN-NeerjaNeural is the female counterpart).

Usage:
  python tts.py ads/clinic.md out/_audio_clinic --voice en-IN-PrabhatNeural
"""
from __future__ import annotations
import asyncio
import json
import os
import re
import sys
from pathlib import Path

import edge_tts

# `|` splits the row; the voice-over column is the second cell. Trim and
# drop the column separator rows.
ROW = re.compile(r"^\|\s*([0-9:]+)\s*\|\s*(.+?)\s*\|\s*([^|]+?)\s*\|\s*(\d+s)\s*\|?\s*$")


def parse(md: Path) -> list[dict]:
    lines: list[dict] = []
    for raw in md.read_text(encoding="utf-8").splitlines():
        m = ROW.match(raw)
        if not m:
            continue
        # The header row has `t` in column one and `voice-over` in two.
        if m.group(1).lower() == "t":
            continue
        lines.append({
            "t": m.group(1),
            "vo": m.group(2).strip(),
            "scene": m.group(3).strip(),
            "hold": int(m.group(4).rstrip("s")),
        })
    return lines


async def synth(text: str, out: Path, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> None:
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch)
    await communicate.save(str(out))


FFMPEG = r"C:\Users\Suhelali\OneDrive\Desktop\nayaverse-studio\node_modules\ffmpeg-static\ffmpeg.exe"


def mp3_duration(path: Path) -> float:
    # ffmpeg prints "Duration: HH:MM:SS.ss" on stderr in its banner.
    # Parse it rather than installing a second audio lib.
    import subprocess
    r = subprocess.run(
        [FFMPEG, "-hide_banner", "-i", str(path)],
        capture_output=True, text=True,
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        raise RuntimeError(f"could not read duration from {path}: {r.stderr[:200]}")
    h, m2, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + m2 * 60 + s


async def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python tts.py <script.md> <out_dir> [--voice NAME]")
        return 2
    md = Path(sys.argv[1])
    out = Path(sys.argv[2])
    voice = "en-IN-PrabhatNeural"
    if "--voice" in sys.argv:
        voice = sys.argv[sys.argv.index("--voice") + 1]
    out.mkdir(parents=True, exist_ok=True)
    lines = parse(md)
    if not lines:
        print(f"no rows parsed from {md}")
        return 2
    print(f"synthesising {len(lines)} lines with {voice}...")
    manifest: list[dict] = []
    for i, line in enumerate(lines):
        clip = out / f"line-{i:02d}.mp3"
        # A touch slower than default: these are read over footage, so
        # the ear needs to land each phrase, not race.
        await synth(line["vo"], clip, voice, rate="-5%")
        dur = mp3_duration(clip)
        manifest.append({**line, "clip": clip.name, "duration": dur})
        print(f"  {i:02d}  {dur:5.2f}s  {line['vo'][:60]}")
    (out / "manifest.json").write_text(json.dumps({"voice": voice, "lines": manifest}, indent=2), encoding="utf-8")
    print(f"wrote {out / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
