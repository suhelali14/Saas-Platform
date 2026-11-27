"""
Ad title/problem/promise/outro cards with layout variations the ffmpeg
filter graph in render-ad.mjs can fade and scale over time. One still
PNG per variant; ffmpeg animates the motion on the clip.

Usage:
  python ad-cards.py title   out/title.png   "Nayaverse Clinic" "The single-doctor OPD" "A clinic in Sangli"
  python ad-cards.py problem out/prob.png    "Every visit copied twice."  "Every follow-up a phone call."  "Every prescription read at the till."
  python ad-cards.py promise out/promise.png "Nayaverse runs this clinic."
  python ad-cards.py outro   out/outro.png   "Try it." "nayaverse.in"
"""
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from colorsys import hls_to_rgb

W, H = 1440, 900


def hsl(h, s, l):
    r, g, b = hls_to_rgb(h / 360, l / 100, s / 100)
    return (int(r * 255), int(g * 255), int(b * 255))


BG = hsl(42, 36, 95)
INK = hsl(45, 8, 10)
SOFT = hsl(39, 10, 38)
PRIMARY = hsl(36, 81, 58)
CARD = hsl(43, 100, 99)

DISPLAY = "C:/Windows/Fonts/ARIALNB.TTF"
UI = "C:/Windows/Fonts/segoeuib.ttf"
UI_REG = "C:/Windows/Fonts/segoeui.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = (line + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def centred(d, text, fnt, y, fill, W=W):
    w = d.textlength(text, font=fnt)
    d.text(((W - w) / 2, y), text, font=fnt, fill=fill)
    return y + fnt.size


def title(out: str, eyebrow: str, main: str, sub: str) -> None:
    """Opening card: brand eyebrow, big title, a short rule, subtitle."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    f_eye = font(UI, 20)
    f_main = font(DISPLAY, 132)
    f_sub = font(UI_REG, 32)

    centred(d, eyebrow.upper(), f_eye, 300, SOFT)

    lines = wrap(d, main, f_main, W - 240)
    y = 340
    for line in lines:
        y = centred(d, line, f_main, y, INK) + 4

    bar_x = (W - 200) // 2
    d.rounded_rectangle([bar_x, y + 20, bar_x + 200, y + 26], radius=3, fill=PRIMARY)
    y += 50

    sub_lines = wrap(d, sub, f_sub, W - 320)
    y_sub = y + 10
    for line in sub_lines:
        y_sub = centred(d, line, f_sub, y_sub, SOFT) + 8

    # A tiny framing dot bottom right so the card does not feel empty.
    d.text((W - 160, H - 90), "DEMO · 2026", font=font(UI, 14), fill=SOFT)
    im.save(out, "PNG")


def problem(out: str, a: str, b: str, c: str) -> None:
    """Three short lines stacked, the problem as a reader sees it."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    f_big = font(DISPLAY, 88)
    f_sub = font(UI_REG, 22)

    centred(d, "WHAT IT IS TODAY", f_sub, 260, SOFT)

    y = 310
    for line in (a, b, c):
        for wrapped in wrap(d, line, f_big, W - 240):
            y = centred(d, wrapped, f_big, y, INK) + 12
        y += 10

    im.save(out, "PNG")


def promise(out: str, text: str) -> None:
    """One line, the promise. Nothing else, so it carries weight."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    f_big = font(DISPLAY, 160)

    centred(d, "NAYAVERSSE", font(UI, 24), 360, PRIMARY)
    lines = wrap(d, text, f_big, W - 200)
    y = 410
    for line in lines:
        y = centred(d, line, f_big, y, INK) + 8

    bar_x = (W - 240) // 2
    d.rounded_rectangle([bar_x, y + 30, bar_x + 240, y + 36], radius=3, fill=PRIMARY)
    im.save(out, "PNG")


def outro(out: str, main: str, sub: str) -> None:
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    f_big = font(DISPLAY, 140)
    f_sub = font(UI, 36)

    y = centred(d, main, f_big, 340, INK) + 24
    bar_x = (W - 180) // 2
    d.rounded_rectangle([bar_x, y + 10, bar_x + 180, y + 16], radius=3, fill=PRIMARY)
    centred(d, sub, f_sub, y + 50, SOFT)

    centred(d, "NAYAVERSSE CLINIC", font(UI, 18), H - 140, SOFT)
    im.save(out, "PNG")


def lower_third(out: str, text: str) -> None:
    """A transparent lower third: a short line of text on a dark band at
    the bottom of the frame, with an amber accent. Composed over the
    scene footage by the renderer."""
    band_h = 150
    im = Image.new("RGBA", (W, band_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # The band itself: deep ink at 85% opacity, rounded, inset.
    d.rounded_rectangle([60, 20, W - 60, band_h - 10], radius=16,
                        fill=(INK[0], INK[1], INK[2], 220))
    # The amber accent bar on the left.
    d.rounded_rectangle([80, 40, 86, band_h - 30], radius=3, fill=PRIMARY)

    f = font(UI, 32)
    f_small = font(UI_REG, 20)
    # Up to two lines of readable copy.
    main, aside = (text.split("|", 1) + [""])[:2]
    main = main.strip()
    aside = aside.strip()

    lines = wrap(d, main, f, W - 240)
    y = 36
    for line in lines[:2]:
        d.text((110, y), line, font=f, fill=(245, 243, 237))
        y += f.size + 2
    if aside:
        d.text((110, y + 4), aside, font=f_small, fill=(210, 206, 196))

    im.save(out, "PNG")


if __name__ == "__main__":
    kind = sys.argv[1]
    out = sys.argv[2]
    args = sys.argv[3:]
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    if kind == "title":
        title(out, args[0], args[1], args[2])
    elif kind == "problem":
        problem(out, args[0], args[1], args[2])
    elif kind == "promise":
        promise(out, args[0])
    elif kind == "outro":
        outro(out, args[0], args[1])
    elif kind == "lower_third":
        lower_third(out, args[0])
    else:
        raise SystemExit(f"unknown kind {kind}")
