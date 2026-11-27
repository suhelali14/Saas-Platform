# Story videos: the reel and the YouTube intro

Two videos made from one engine, in the style of an explainer reel: a
problem told with drawn 2D props on a dark ground, then the answer shown
with real screenshots of the clinic portal on cream paper. The voice-over
lights up word by word as a caption, with one word in italic serif.

| File | Format | Length |
|---|---|---|
| `out/nayaversse-teaser-30s.mp4` (`render-reel.mjs`) | 1080x1920 teaser (flap board, effects, no voice) | 30 s |
| `out/nayaversse-reel.mp4` (from `story-reel.json`) | 1080x1920 reel, voice + music + effects | ~1:48 |
| `out/nayaversse-yt.mp4` (from `story-yt.json`) | 1920x1080 intro, voice + music + effects | ~3:56 |

## Re-rendering

Run from the repo root (Git Bash or PowerShell):

```
node scripts/demo-video/reel/render-story.mjs story-reel.json            # full render
node scripts/demo-video/reel/render-story.mjs story-reel.json --stills 12,40.5   # check a few frames
node scripts/demo-video/reel/render-story.mjs story-reel.json --vo       # after changing any spoken line
python scripts/demo-video/reel/scan-frames.py scripts/demo-video/out/nayaversse-reel.mp4
```

- Editing a zoom, ring, punch word or card needs no `--vo`: the renderer
  reads visuals fresh from the script every time. Changing `cap` or `say`
  does, because word timings come from the voice.
- In a script, `"at": "w:4"` means "when word 4 of the caption is spoken".
  Rectangles (`r`) are fractions of the screenshot: `[x, y, width, height]`.
- `*word*` in a caption becomes the italic serif accent word.

## Screenshots

`capture-modules.mjs` signs in to the deployed demo (`demo-multispecialty`)
and screenshots every module, at 1100x1250 for the reel and 1600x1000 for
YouTube (`FORMAT=reel|yt`). It only navigates; it never saves anything.
`seed-demo-queue.mjs` puts a made-up morning queue on the demo (the nightly
reset wipes it), and must run before the queue, consultation and live-queue
shots.

Known issue on the demo while capturing (2026-11-20): the portal at
`portal.nayaversse.in` still calls the API on the old `nayaverse.in` host,
which refuses the new origin (CORS), so a normal browser cannot sign in.
The capture browser runs with web security off as a stopgap.

## Sound

Voice: edge-tts `en-IN-NeerjaNeural` (`vo.py`). Music: a quiet chord bed
synthesised in `mix.py`, ducked under the voice. Effects (flap rattles,
stamps, taps, whooshes): synthesised in `sfx.py` from events the page
emits. Nothing needs a licence. For Instagram, trending audio can still be
added in the app; lower "original audio" to about 30% so the voice stays
clear.
