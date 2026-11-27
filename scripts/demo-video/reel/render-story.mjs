#!/usr/bin/env node
/**
 * Render a story video (the reel or the YouTube intro) from its script.
 *
 *   node scripts/demo-video/reel/render-story.mjs story-reel.json          full render
 *   node scripts/demo-video/reel/render-story.mjs story-reel.json --stills 3,9.5,20
 *   node scripts/demo-video/reel/render-story.mjs story-yt.json --vo        re-synthesise the voice first
 *
 * Steps: vo.py (voice + word timings -> timeline.json, vo.wav) when the
 * timeline is missing or --vo is passed; then every frame of story.html is
 * rendered and piped into ffmpeg; then sfx.py synthesises the page's sound
 * events and mix.py lays voice, a quiet ambient bed and the effects together.
 *
 * Everything the page loads is served from one fake origin by page.route,
 * so fonts, screenshots and the logo load like a normal site with no CORS
 * or data-URI bloat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const OUT = path.resolve(HERE, '../out');
const FFMPEG = 'C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe';
const NM = [path.join(REPO, 'node_modules'), path.resolve(HERE, '../node_modules')];

const args = process.argv.slice(2);
const scriptFile = path.resolve(HERE, args[0] || 'story-reel.json');
const name = path.basename(scriptFile, '.json');
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;
const work = path.join(OUT, `_${name}`);
const timelineFile = path.join(work, 'timeline.json');

if (args.includes('--vo') || !fs.existsSync(timelineFile)) {
  const r = spawnSync('python', [path.join(HERE, 'vo.py'), scriptFile, work], { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) process.exit(1);
}
// The voice step owns timing (beat start/end, voice span, word times); the
// script owns everything visual. Merge them fresh on every render so an edit
// to a zoom or a punch word never needs the voice re-synthesised.
//
// A language script ("base": "story-reel.json") carries only its words:
// captions, voice lines, chapter names, punch words. Its visuals come from the
// base script, with every 'w:N' cue (tied to an English word) turned into
// 'f:x' (the same fraction of the way through the line), because word order
// differs between languages.
const timed = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
let script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
if (script.base) {
  const baseFile = path.resolve(HERE, script.base);
  const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  const baseTl = JSON.parse(fs.readFileSync(path.join(OUT, `_${path.basename(baseFile, '.json')}`, 'timeline.json'), 'utf8'));
  const toFrac = (v, bt) => {
    if (typeof v === 'string' && /^w:\d+$/.test(v)) {
      const w = bt.words[Math.min(+v.slice(2), bt.words.length - 1)];
      const f = w ? (w.t - bt.vo0) / Math.max(0.01, bt.vo1 - bt.vo0) : 0;
      return 'f:' + Math.max(0, Math.min(1, f)).toFixed(3);
    }
    if (Array.isArray(v)) return v.map(x => toFrac(x, bt));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFrac(x, bt)]));
    return v;
  };
  const { beats: langBeats, base: _b, ...langTop } = script;
  const { beats: baseBeats, ...baseTop } = base;
  script = { ...baseTop, ...langTop, beats: baseBeats.map((bb, i) => ({ ...toFrac(bb, baseTl.beats[i]), ...langBeats[i] })) };
}
if (script.beats.length !== timed.beats.length) { console.error('script and timeline beat counts differ: run with --vo'); process.exit(1); }
const timeline = { ...script, duration: timed.duration,
  beats: script.beats.map((b, i) => { const { t0, t1, vo0, vo1, words, i: idx } = timed.beats[i]; return { ...b, t0, t1, vo0, vo1, words, i: idx }; }) };
const mergedFile = path.join(work, 'timeline-merged.json');
fs.writeFileSync(mergedFile, JSON.stringify(timeline));
const shotsDir = path.join(OUT, timeline.shots || 'modules-reel');

const FONT_CSS = [
  '@fontsource-variable/ibm-plex-sans/wght.css',
  '@fontsource/ibm-plex-mono/400.css', '@fontsource/ibm-plex-mono/600.css',
  '@fontsource/barlow-condensed/600.css', '@fontsource/barlow-condensed/700.css',
  '@fontsource/inter/700.css', '@fontsource/inter/800.css',
  '@fontsource/instrument-serif/400-italic.css', '@fontsource/instrument-serif/400.css',
  '@fontsource/ibm-plex-sans-devanagari/500.css', '@fontsource/ibm-plex-sans-devanagari/700.css',
];
const findNm = rel => NM.map(d => path.join(d, rel)).find(f => fs.existsSync(f));
function fontsCss() {
  let out = '';
  for (const rel of FONT_CSS) {
    const file = findNm(rel);
    if (!file) { console.error('missing font css', rel); continue; }
    const pkgDir = path.dirname(rel);
    out += fs.readFileSync(file, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, (_, f) => `url(/nm/${pkgDir}/files/${f})`) + '\n';
  }
  return out;
}

const ORIGIN = 'http://story.local';
const TYPES = { '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html' };
const FONTS = fontsCss();

/* one browser + page with the story loaded, ready and warmed up */
async function openPage() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: timeline.W, height: timeline.H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(`${ORIGIN}/**`, async route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    let body, file;
    if (p === '/story.html') file = path.join(HERE, 'story.html');
    else if (p === '/story-data.js') body = 'window.STORY = ' + JSON.stringify(timeline) + ';';
    else if (p === '/fonts.css') body = FONTS;
    else if (p.startsWith('/nm/')) file = findNm(p.slice(4));
    else if (p.startsWith('/shots/')) file = path.join(shotsDir, path.basename(p));
    else if (p.startsWith('/assets/')) file = path.join(HERE, 'assets', path.basename(p));
    const type = TYPES[path.extname(p)] || 'application/octet-stream';
    if (body != null) return route.fulfill({ status: 200, contentType: type, body });
    if (file && fs.existsSync(file)) return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    errors.push('404 ' + p);
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/story.html`, { waitUntil: 'load' });
  let meta;
  try { meta = await page.evaluate(() => window.REEL.ready()); } catch (e) { errors.push(String(e)); }
  if (errors.length) { console.error('page errors:\n' + errors.join('\n')); await browser.close(); process.exit(1); }
  const frame = async t => {
    // render, then let the compositor finish one frame before capturing: the
    // first paint of a large blurred or clipped layer can otherwise be caught
    // half-drawn (seen once as a near-black still)
    await page.evaluate(tt => new Promise(res => { window.REEL.render(tt); requestAnimationFrame(() => res()); }), t);
    return page.screenshot({ type: 'png' });
  };
  // warm-up: draw the middle of every beat once and throw the pixels away
  for (const b of timeline.beats) await frame((b.t0 + b.t1) / 2);
  return { browser, page, frame, meta };
}

const FPS = timeline.fps || 30, DUR = timeline.duration;
const t0 = Date.now();

if (stills) {
  const w = await openPage();
  console.log(`${name}: ${DUR.toFixed(1)}s, ${timeline.beats.length} beats`);
  const dir = path.join(OUT, `${name}-stills`);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stills) {
    const f = path.join(dir, `t-${s.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, await w.frame(s));
    console.log(f);
  }
  await w.browser.close();
  process.exit(0);
}

/* full render: N browsers each take a contiguous run of frames into their own
   segment, then the segments are joined without re-encoding */
const WORKERS = args.includes('--workers') ? +args[args.indexOf('--workers') + 1] : 8;
const total = Math.round(FPS * DUR);
const per = Math.ceil(total / WORKERS);
let done = 0, meta = null;
const segs = await Promise.all(Array.from({ length: WORKERS }, async (_, k) => {
  const a = k * per, b = Math.min(total, a + per);
  if (a >= b) return null;
  const w = await openPage();
  if (!meta) meta = w.meta;
  const seg = path.join(work, `seg-${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-threads', '6', '-rc-lookahead', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    const buf = await w.frame(i / FPS);
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    if (++done % 300 === 0) console.log(`frames ${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  const [code] = await once(ff, 'close');
  await w.browser.close();
  if (code !== 0) { console.error('ffmpeg failed on segment', k); process.exit(1); }
  return seg;
}));
const listFile = path.join(work, 'segments.txt');
fs.writeFileSync(listFile, segs.filter(Boolean).map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
const silent = path.join(work, 'silent.mp4');
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit' }); if (r.status !== 0) { console.error(cmd, 'failed'); process.exit(1); } };
run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent]);
console.log(`video: ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s with ${WORKERS} workers`);

const evFile = path.join(work, 'sfx.json'), sfxWav = path.join(work, 'sfx.wav'), mixWav = path.join(work, 'mix.wav');
fs.writeFileSync(evFile, JSON.stringify(meta.sfx));
run('python', [path.join(HERE, 'sfx.py'), evFile, sfxWav, String(DUR)]);
run('python', [path.join(HERE, 'mix.py'), mergedFile, path.join(work, 'vo.wav'), sfxWav, mixWav]);
const final = path.join(OUT, `nayaversse-${name.replace('story-', '')}.mp4`);
run(FFMPEG, ['-y', '-loglevel', 'error', '-i', silent, '-i', mixWav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', final]);
console.log(`final: ${final}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
