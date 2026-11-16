# Demo videos, one per tier

Four MP4 videos — Clinic, Polyclinic, Hospital, Multi-specialty — made by
recording the real portal doing the real work, then composed with branded
title cards and captions. A narration script sits next to each tier for the
voiceover: this pipeline produces no spoken audio because the voices
available on this machine are the robotic Windows ones, and that would make
a demo look amateur. Record the script yourself or hand it to a voice
artist; the videos below carry the captions on screen and are watchable
without sound.

## How it fits together

- **`tiers/*.mjs`** — the scene list for one tier. Each scene says
  _what the portal does_ (sign in as this person, go to this screen, click
  this, zoom into that) and _what the caption says._ Scenes build on each
  other: Hospital picks up from Polyclinic, Multi-specialty from Hospital.
- **`lib.mjs`** — shared helpers Playwright uses: sign in, move the mouse
  smoothly, open the recording, write a single scene as a WebM.
- **`title.py`** — the still cards, drawn with PIL in the portal's own look
  (dark background, Barlow Condensed display, the primary amber for the
  accent line). Three kinds: the tier intro, a section title between
  groups, and an outro.
- **`render-tier.mjs`** — the orchestrator. Runs every scene, composes the
  captions and the zoom moves on top with ffmpeg's overlay and zoompan
  filters, encodes to H.264 + AAC, and concatenates the whole thing.

## Running it

The local demo stack has to be up on the usual ports (API at 4100, web at
5176) with `CLINIC_PLAN=ENTERPRISE` so every module is available. The
scripts assume `scripts/dev-redis.mjs 6380` and the scratchpad Postgres on
54341. Then:

```sh
node scripts/demo-video/render-tier.mjs clinic
node scripts/demo-video/render-tier.mjs polyclinic
node scripts/demo-video/render-tier.mjs hospital
node scripts/demo-video/render-tier.mjs multi
```

Each writes `scripts/demo-video/out/<tier>.mp4` beside its narration.

## What is deliberately not in here

- **AI-generated marketing images.** No image model is available in this
  environment. The title cards use the portal's own look: that reads as a
  product demo rather than a stock deck, and it stays true to what the
  thing actually is.
- **Spoken narration.** The voices available on Windows here are robotic,
  and a tinny voice is the quickest way to make a product look cheap.
  The narration lives in `narration/*.md` as a script to read into a mic
  after the fact. Each line is short enough to say over the scene it
  belongs to.
