"""Upscale the 500px brand lockup for video.

The only wordmark the repo has is public/logo.png (500x500, the lockup is
318px wide). Scaled 4x straight it goes soft. Because it is one flat colour,
the alpha channel can be upscaled smoothly and then re-sharpened with a steep
curve, which gives clean vector-like edges without inventing detail.
Writes the wordmark and the tagline as separate PNGs so they can animate apart.
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
SCALE = 4
COLOR = (219, 74, 43)

im = Image.open(SRC).convert("RGBA")
alpha = im.split()[-1]
w, h = im.size

# Find the blank band between wordmark and tagline.
rows = [any(alpha.getpixel((x, y)) > 8 for x in range(w)) for y in range(h)]
bands, start = [], None
for y, on in enumerate(rows + [False]):
    if on and start is None:
        start = y
    if not on and start is not None:
        bands.append((start, y))
        start = None
print("ink bands:", bands)

def crisp(box, name):
    a = alpha.crop(box)
    a = a.resize((a.width * SCALE, a.height * SCALE), Image.BICUBIC)
    # Steep sigmoid-ish curve: keeps a 1-2px antialias edge, kills the blur.
    a = a.point(lambda v: 0 if v < 70 else 255 if v > 185 else int((v - 70) * 255 / 115))
    solid = Image.new("RGBA", a.size, COLOR + (255,))
    solid.putalpha(a)
    bbox = a.getbbox()
    solid = solid.crop(bbox)
    solid.save(OUT / name)
    print(name, solid.size)

cols = lambda y0, y1: [x for x in range(w) if any(alpha.getpixel((x, y)) > 8 for y in range(y0, y1))]
mark = bands[0]
tag = bands[-1]
pad = 3
for (y0, y1), name in [(mark, "wordmark.png"), (tag, "tagline.png")]:
    xs = cols(y0, y1)
    crisp((max(0, xs[0] - pad), max(0, y0 - pad), min(w, xs[-1] + pad + 1), min(h, y1 + pad)), name)
