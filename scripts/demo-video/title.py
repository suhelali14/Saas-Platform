"""
Title and section cards, drawn in the portal's own look.

The display face is Arial Narrow Bold -- the closest condensed face
Windows ships out of the box, standing in for Barlow Condensed so a
viewer who knows the portal reads the cards as part of it. Colours come
from the light theme: cream background (42 36% 95%), deep ink
(45 8% 10%), amber primary (36 81% 58%).

Usage:
  python title.py intro out.png "Clinic plan" "From single-doctor OPD..."
  python title.py section out.png "Money" "Billing and the day's close"
  python title.py outro out.png "Thank you" "What runs the clinic in Sangli today."
  python title.py caption out.png "An emergency walks in and jumps ahead"
"""
from __future__ import annotations
import sys
from PIL import Image, ImageDraw, ImageFont
from colorsys import hls_to_rgb

W, H = 1440, 900

def hsl(h, s, l):
    r, g, b = hls_to_rgb(h / 360, l / 100, s / 100)
    return (int(r * 255), int(g * 255), int(b * 255))

BG      = hsl(42, 36, 95)   # background
INK     = hsl(45, 8, 10)    # foreground
INK_SOFT= hsl(39, 10, 38)   # muted-foreground
PRIMARY = hsl(36, 81, 58)   # amber primary
CARD    = hsl(43, 100, 99)  # card
RULE    = (0, 0, 0, 32)

FONT_DISPLAY = "C:/Windows/Fonts/ARIALNB.TTF"   # Barlow Condensed stand-in
FONT_UI      = "C:/Windows/Fonts/segoeuib.ttf"  # Segoe UI Semibold-ish
FONT_UI_REG  = "C:/Windows/Fonts/segoeui.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def wrap(draw, text, font, max_width):
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = (line + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_width:
            line = trial
        else:
            if line: lines.append(line)
            line = w
    if line: lines.append(line)
    return lines

def centred(draw, text, font, y, width, fill):
    tw = draw.textlength(text, font=font)
    draw.text(((width - tw) / 2, y), text, font=font, fill=fill)
    return y + font.size

def card(draw, x, y, w, h, radius=14, fill=CARD):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill)

def intro(out_path, title, subtitle, tier_label="Nayaverse Clinic"):
    """
    Tier intro: brand mark top left, the tier name big in the centre, a
    one-line subtitle under it, an amber ruling that draws itself under
    the pair. Deliberately sparse: the title is the thing.
    """
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    # Brand strip: eyebrow + mark
    d.text((72, 72), "NAYAVERSE CLINIC",
           font=font(FONT_UI, 18), fill=INK_SOFT)
    d.text((72, 94), tier_label, font=font(FONT_DISPLAY, 36), fill=INK)

    # The big title, broken onto two lines if it must be.
    f_big = font(FONT_DISPLAY, 136)
    lines = wrap(d, title, f_big, W - 240)
    total = len(lines) * (f_big.size + 10)
    y = (H - total) // 2 - 90
    for line in lines:
        y = centred(d, line, f_big, y, W, INK) + 6

    # Amber rule: a short bar that aligns the eye.
    bar_x = (W - 220) // 2
    y_bar = y + 30
    d.rounded_rectangle([bar_x, y_bar, bar_x + 220, y_bar + 4], radius=2, fill=PRIMARY)

    # Subtitle under the rule, in the muted ink.
    f_sub = font(FONT_UI_REG, 30)
    sub_lines = wrap(d, subtitle, f_sub, W - 320)
    y_sub = y_bar + 32
    for line in sub_lines:
        y_sub = centred(d, line, f_sub, y_sub, W, INK_SOFT) + 10

    # Footer corner: small meta so the card reads as part of a product.
    d.text((W - 72 - d.textlength("Demo", font=font(FONT_UI, 16)), H - 90), "DEMO",
           font=font(FONT_UI, 16), fill=INK_SOFT)

    im.save(out_path, "PNG")

def section(out_path, index, title, subtitle):
    """A section card between groups of scenes: number, title, short lede."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    # A card inset, so it reads as the portal's own panel style.
    card(d, 120, 160, W - 240, H - 320, radius=20, fill=CARD)

    # Section number, small and amber.
    num = f"{index:02d}"
    d.text((180, 220), f"SECTION {num}", font=font(FONT_UI, 20), fill=PRIMARY)

    # The title, big.
    f_title = font(FONT_DISPLAY, 96)
    lines = wrap(d, title, f_title, W - 320)
    y = 300
    for line in lines:
        d.text((180, y), line, font=f_title, fill=INK); y += f_title.size + 6

    # A short ruling.
    d.rounded_rectangle([180, y + 26, 300, y + 30], radius=2, fill=PRIMARY)

    # The lede.
    f_sub = font(FONT_UI_REG, 28)
    sub_lines = wrap(d, subtitle, f_sub, W - 320)
    y_sub = y + 64
    for line in sub_lines:
        d.text((180, y_sub), line, font=f_sub, fill=INK_SOFT); y_sub += f_sub.size + 8

    im.save(out_path, "PNG")

def outro(out_path, title, subtitle):
    """Closing card: the message, the brand mark, nothing else."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)

    f_big = font(FONT_DISPLAY, 120)
    y = centred(d, title, f_big, 310, W, INK) + 20

    bar_x = (W - 180) // 2
    d.rounded_rectangle([bar_x, y + 10, bar_x + 180, y + 14], radius=2, fill=PRIMARY)

    f_sub = font(FONT_UI_REG, 30)
    sub_lines = wrap(d, subtitle, f_sub, W - 320)
    y_sub = y + 50
    for line in sub_lines:
        y_sub = centred(d, line, f_sub, y_sub, W, INK_SOFT) + 10

    centred(d, "NAYAVERSE CLINIC", font(FONT_UI, 20), H - 120, W, INK_SOFT)

    im.save(out_path, "PNG")

def caption(out_path, text):
    """
    A caption overlay: a bottom band carrying one line of what is on screen
    now. Saved transparent, so the compositor overlays it on the scene
    recording.
    """
    im = Image.new("RGBA", (W, 170), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # The band: deep-ink, soft at the edges.
    d.rounded_rectangle([60, 30, W - 60, 150], radius=18, fill=(INK[0], INK[1], INK[2], 235))
    # A thin amber line on the left to make it part of the portal.
    d.rounded_rectangle([76, 46, 80, 134], radius=2, fill=PRIMARY)

    f_cap = font(FONT_UI, 32)
    f_sub = font(FONT_UI_REG, 20)
    # Up to two lines; if there is a pipe, the part after is a smaller aside.
    main, aside = (text.split("|", 1) + [""])[:2]
    main = main.strip(); aside = aside.strip()

    main_lines = wrap(d, main, f_cap, W - 230)
    y = 46
    for line in main_lines:
        d.text((104, y), line, font=f_cap, fill=(245, 243, 237))
        y += f_cap.size + 4
    if aside:
        d.text((104, y + 2), aside, font=f_sub, fill=(200, 194, 180))

    im.save(out_path, "PNG")

if __name__ == "__main__":
    kind = sys.argv[1]
    out = sys.argv[2]
    args = sys.argv[3:]
    if kind == "intro": intro(out, args[0], args[1], args[2] if len(args) > 2 else "Nayaverse Clinic")
    elif kind == "section": section(out, int(args[0]), args[1], args[2])
    elif kind == "outro": outro(out, args[0], args[1])
    elif kind == "caption": caption(out, args[0])
    else: raise SystemExit(f"unknown kind {kind}")
