"""Find glitch frames in a rendered video.

    python scan-frames.py out/nayaversse-reel-story.mp4

A glitch frame (a half-painted capture) differs sharply from both of its
neighbours while the neighbours match each other. Real cuts and wipes do not
look like that: they change and stay changed. Prints each suspect frame's
time so it can be re-rendered or inspected.
"""
import subprocess
import sys

import numpy as np

FFMPEG = "C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe"
path = sys.argv[1]
w, h = 96, 96
raw = subprocess.run([FFMPEG, "-loglevel", "error", "-i", path, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
n = len(fr)
d = lambda a, b: float(np.mean(np.abs(fr[a] - fr[b])))
bad = []
for i in range(1, n - 1):
    a, b, c = d(i - 1, i), d(i, i + 1), d(i - 1, i + 1)
    if a > 18 and b > 18 and c < 6:
        bad.append((i, a, b, c))
print(f"{n} frames scanned, {len(bad)} suspect")
for i, a, b, c in bad[:40]:
    print(f"  frame {i}  t={i / 30:.2f}s  prev {a:.1f} next {b:.1f} neighbours {c:.1f}")
