#!/usr/bin/env node
/**
 * Cuts the films the website shows, from the finished renders in out/.
 *
 *   node scripts/demo-video/web-films.mjs
 *
 * Writes into apps/nayaverse-web/public/video:
 *   assistant.mp4            the whole assistant film (reel/story-assistant.json)
 *   assistant-<part>.mp4     one short film per feature, cut at the story's
 *                            chapter boundaries so it never has to be rendered twice
 *   clinic-en|hi|mr.mp4      the clinic film in each language (story-yt*.json)
 *   *.jpg                    a still for each, shown until somebody presses play
 *
 * The site copies are 720p and compressed hard: they are watched in a
 * panel on a page, often on a phone, and every megabyte here is committed.
 * The full-quality films stay in out/, which is not committed.
 *
 * The parts and their names are the ones content/products.ts lists
 * (`assistantFilms`); a chapter renamed in the story must be renamed here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const SITE = path.join(HERE, '../../apps/nayaverse-web/public/video');
const FFMPEG = process.env.FFMPEG_PATH ?? 'C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe';
fs.mkdirSync(SITE, { recursive: true });

function ff(argv, what) {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...argv], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${what}`);
}
const SMALL = ['-c:v', 'libx264', '-crf', '29', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '80k', '-ac', '1', '-movflags', '+faststart'];
const mb = (f) => `${(fs.statSync(f).size / 1e6).toFixed(1)} MB`;
const still = (from, at, to) => ff(['-ss', at.toFixed(2), '-i', from, '-frames:v', '1', '-vf', 'scale=1280:720', '-q:v', '4', to], `still ${to}`);

// ── The assistant: whole, then by chapter ─────────────────────────────
const film = path.join(OUT, 'nayaversse-assistant.mp4');
const beats = JSON.parse(fs.readFileSync(path.join(OUT, '_story-assistant/timeline-merged.json'), 'utf8')).beats;
const span = (chapter) => {
  const mine = beats.filter((b) => b.chapter === chapter);
  if (!mine.length) throw new Error(`the story has no chapter called "${chapter}"`);
  return [mine[0].t0, mine.at(-1).t1];
};
ff(['-i', film, '-vf', 'scale=1280:720', ...SMALL, path.join(SITE, 'assistant.mp4')], 'assistant');
// A still is taken just before a beat ends: its caption has finished
// appearing by then and has not started to leave.
const settled = (list, chapter, nth = 0) => {
  const mine = list.filter((b) => b.chapter === chapter);
  const b = mine[Math.min(nth, mine.length - 1)];
  if (!b) throw new Error(`no chapter called "${chapter}"`);
  return b.t1 - 0.6;
};
still(film, settled(beats, 'SAY IT', 1), path.join(SITE, 'assistant.jpg'));
console.log(`assistant.mp4  ${mb(path.join(SITE, 'assistant.mp4'))}`);

const PARTS = { say: 'SAY IT', language: 'ANY LANGUAGE', yes: 'ONE SENTENCE, ONE YES', limits: "EVERYONE'S OWN LIMITS", room: 'IN THE CONSULTING ROOM' };
for (const [name, chapter] of Object.entries(PARTS)) {
  const [t0, t1] = span(chapter);
  const len = t1 - t0;
  const to = path.join(SITE, `assistant-${name}.mp4`);
  // A short fade at each end: a chapter is cut out of a running film, and
  // without it the part would start on a half-finished move.
  ff(['-ss', t0.toFixed(2), '-t', len.toFixed(2), '-i', film,
    '-vf', `scale=1280:720,fade=t=in:st=0:d=0.3,fade=t=out:st=${(len - 0.3).toFixed(2)}:d=0.3`,
    '-af', `afade=t=in:st=0:d=0.2,afade=t=out:st=${(len - 0.3).toFixed(2)}:d=0.3`, ...SMALL, to], name);
  still(film, settled(beats, chapter, 9), path.join(SITE, `assistant-${name}.jpg`));
  console.log(`assistant-${name}.mp4  ${len.toFixed(1)}s  ${mb(to)}`);
}

// ── Growth (reel/story-growth.json) ───────────────────────────────────
{
  const from = path.join(OUT, 'nayaversse-growth.mp4');
  if (fs.existsSync(from)) {
    const to = path.join(SITE, 'growth.mp4');
    ff(['-i', from, '-vf', 'scale=1280:720', ...SMALL, to], 'growth');
    // The product at work: the consent list. Not the proof screen, whose
    // rupee figure is a demo salon's and would read as a result.
    const growthBeats = JSON.parse(fs.readFileSync(path.join(OUT, '_story-growth/timeline-merged.json'), 'utf8')).beats;
    still(from, settled(growthBeats, 'ONLY WHO AGREED', 0), path.join(SITE, 'growth.jpg'));
    console.log(`growth.mp4  ${mb(to)}`);
  } else console.log('growth: nayaversse-growth.mp4 is not rendered, left out');
}

// ── The clinic film, in each language ─────────────────────────────────
for (const [lang, file] of Object.entries({ en: 'nayaversse-yt.mp4', hi: 'nayaversse-yt-hi.mp4', mr: 'nayaversse-yt-mr.mp4' })) {
  const from = path.join(OUT, file);
  if (!fs.existsSync(from)) { console.log(`clinic-${lang}: ${file} is not rendered, left out`); continue; }
  const to = path.join(SITE, `clinic-${lang}.mp4`);
  ff(['-i', from, '-vf', 'scale=1280:720', ...SMALL, to], `clinic ${lang}`);
  if (lang === 'en') {
    const clinicBeats = JSON.parse(fs.readFileSync(path.join(OUT, '_story-yt/timeline-merged.json'), 'utf8')).beats;
    still(from, settled(clinicBeats, 'THE FRONT DESK', 1), path.join(SITE, 'clinic.jpg'));
  }
  console.log(`clinic-${lang}.mp4  ${mb(to)}`);
}
