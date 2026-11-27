#!/usr/bin/env node
/**
 * Render reel.html (a 30 s, 1080x1920 flat-2D reel) to MP4.
 *
 *   node scripts/demo-video/reel/render-reel.mjs
 *       -> scripts/demo-video/out/nayaversse-reel.mp4  (with sound effects)
 *       -> scripts/demo-video/out/nayaversse-reel-silent.mp4
 *   node scripts/demo-video/reel/render-reel.mjs --stills 1.5,6.8,10.4
 *       -> scripts/demo-video/out/reel-stills/t-01.50.png ...
 *
 * How: the page exposes REEL.render(t), a pure function of time. For every
 * frame we call it, screenshot the viewport and pipe the PNG into ffmpeg. No
 * screen recording, so there are no dropped or doubled frames, and any frame
 * can be re-rendered on its own. Fonts and the logo are inlined as data URIs
 * because a page loaded with setContent cannot fetch file:// fonts.
 *
 * Sound: the page lists its sound events (flap rattles, stamps, taps); sfx.py
 * synthesises them into a WAV, which is muxed in at the end. No music: on
 * Instagram, licensed music is added in the app's own editor.
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
const NM = path.join(REPO, 'node_modules');

const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

/* ---- fonts: fontsource CSS with the latin + devanagari subsets inlined ---- */
const FONT_CSS = [
  '@fontsource/barlow-condensed/600.css',
  '@fontsource/barlow-condensed/700.css',
  '@fontsource-variable/ibm-plex-sans/wght.css',
  '@fontsource/ibm-plex-mono/400.css',
  '@fontsource/ibm-plex-mono/500.css',
  '@fontsource/ibm-plex-mono/600.css',
  '@fontsource/ibm-plex-sans-devanagari/500.css',
  '@fontsource/ibm-plex-sans-devanagari/600.css',
];
function fontCss() {
  let out = '';
  for (const rel of FONT_CSS) {
    const file = path.join(NM, rel);
    const dir = path.dirname(file);
    const css = fs.readFileSync(file, 'utf8');
    const blocks = css.split(/(?=\/\*[^*]*\*\/\s*@font-face)/);
    for (const b of blocks) {
      const name = (b.match(/\/\*\s*([^*]+?)\s*\*\//) || [])[1] || '';
      if (!/latin|devanagari-devanagari/.test(name)) continue;
      out += b
        .replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '')
        .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, f) =>
          `url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, 'files', f)).toString('base64')})`);
    }
  }
  return out;
}
const img = f => `data:image/png;base64,${fs.readFileSync(path.join(HERE, 'assets', f)).toString('base64')}`;

let html = fs.readFileSync(path.join(HERE, 'reel.html'), 'utf8');
html = html.replace('/*FONTS*/', fontCss())
  .replaceAll('{{IMG:wordmark}}', img('wordmark.png'))
  .replaceAll('{{IMG:tagline}}', img('tagline.png'));

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.setContent(html, { waitUntil: 'load' });
const meta = await page.evaluate(() => window.REEL.ready());
const { FPS, DUR } = await page.evaluate(() => ({ FPS: window.REEL.FPS, DUR: window.REEL.DUR }));
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); await browser.close(); process.exit(1); }
console.log(`fonts loaded: ${meta.fonts.length} faces; sound events: ${meta.sfx.length}`);

async function frame(t) {
  await page.evaluate(tt => window.REEL.render(tt), t);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'initial' });
}

if (stillsArg) {
  const dir = path.join(OUT, 'reel-stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stillsArg.split(',').map(Number)) {
    const buf = await frame(s);
    const f = path.join(dir, `t-${s.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
  process.exit(0);
}

/* ---- video ---- */
const silent = path.join(OUT, 'nayaversse-reel-silent.mp4');
const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', silent],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.round(FPS * DUR);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const buf = await frame(i / FPS);
  if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
}
ff.stdin.end();
const [code] = await once(ff, 'close');
await browser.close();
if (code !== 0) { console.error('ffmpeg failed'); process.exit(1); }
console.log(`video: ${silent} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

/* ---- sound ---- */
const evFile = path.join(OUT, '_reel-sfx.json');
const wav = path.join(OUT, '_reel-sfx.wav');
fs.writeFileSync(evFile, JSON.stringify(meta.sfx, null, 1));
const py = spawnSync('python', [path.join(HERE, 'sfx.py'), evFile, wav, String(DUR)], { stdio: 'inherit' });
if (py.status !== 0) { console.error('sfx.py failed'); process.exit(1); }
const final = path.join(OUT, 'nayaversse-teaser-30s.mp4');
const mux = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
if (mux.status !== 0) { console.error('mux failed'); process.exit(1); }
console.log(`final: ${final}`);
