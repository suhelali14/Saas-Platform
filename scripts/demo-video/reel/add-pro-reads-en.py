"""Directed ElevenLabs reads for the English reel and YouTube scripts.

The brand is written in Devanagari (नयावर्स) inside the spoken text, so the
English videos say it exactly the way the Hindi voice does; the captions keep
the Latin spelling. Cues in [brackets] are not spoken and are stripped from
the word timings, so captions still light up word by word.
"""
import io
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
BRAND = "नयावर्स"

TAGS = {
    "story-reel.json": {0: "serious", 1: "tired", 2: "frustrated", 4: "concerned", 5: "softly", 6: "warmly", 7: "confident",
                        9: "reassuring", 10: "upbeat", 14: "confident", 15: "curious", 17: "excited", 18: "warmly"},
    "story-yt.json": {0: "serious", 1: "tired", 2: "frustrated", 4: "concerned", 5: "softly", 6: "warmly", 7: "confident",
                      9: "clear", 13: "reassuring", 15: "upbeat", 19: "curious", 29: "excited", 30: "reassuring", 31: "warmly"},
}


def pro(text, tag):
    t = re.sub(r"\bnayaversse\b", BRAND, text, flags=re.I)
    t = t.replace("who's next?", "[sighs] who's next?")
    t = t.replace("Running beds? ", "Running beds? [confident] ").replace("No cashier? ", "No cashier? [confident] ")
    t = t.replace("Book a demo", "[friendly] Book a demo")
    return (f"[{tag}] " if tag else "") + t


for name, tags in TAGS.items():
    p = HERE / name
    d = json.load(io.open(p, encoding="utf-8"))
    d.update({"tts": "elevenlabs", "elevenVoice": "OtEfb2LVzIE45wdYe54M", "elevenModel": "eleven_v3", "elevenStability": 0.5})
    for i, b in enumerate(d["beats"]):
        base = b.get("say") or b.get("cap", "").replace("*", "")
        if base.strip():
            b["sayPro"] = pro(base, tags.get(i))
    json.dump(d, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(name, "ok:", d["beats"][6]["sayPro"][:70])
