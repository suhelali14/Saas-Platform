#!/usr/bin/env node
/**
 * Render one tier's demo as a single MP4.
 *
 *   node scripts/demo-video/render-tier.mjs <tier>
 *
 * The tier name picks a script in ./tiers; it exports:
 *   title, subtitle, sections (ordered), scenes (ordered)
 *
 * The orchestrator:
 *   1. builds the title card, the section cards, and the closing card
 *      (title.py) as still PNGs, each held for its own duration;
 *   2. runs every scene through Playwright (lib.mjs), which records its
 *      clip to a WebM;
 *   3. renders the caption PNG for each clip and overlays it at the
 *      bottom through its last second;
 *   4. transcodes each piece to a matching MP4 (same codec, same
 *      resolution, same frame rate) so ffmpeg's concat demuxer can glue
 *      them together without re-encoding;
 *   5. writes the final out/<tier>.mp4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { newSession, endSession } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = path.join('C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe');
const PY = 'python';

const tier = process.argv[2];
if (!tier) {
  console.error('Usage: render-tier.mjs <clinic|polyclinic|hospital|multi>');
  process.exit(2);
}

const scenesMod = await import(pathToFileURL(path.join(HERE, 'tiers', `${tier}.mjs`)).href);
const def = scenesMod.default;
const workDir = path.join(HERE, 'out', `_${tier}`);
await fs.promises.rm(workDir, { recursive: true, force: true });
await fs.promises.mkdir(workDir, { recursive: true });

const log = (msg) => { process.stdout.write(`[${tier}] ${msg}\n`); };

/** Wraps spawn in a promise that rejects on non-zero. */
function run(cmd, args, { silent = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: silent ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let err = '';
    if (silent) p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} ${args.join(' ')}\n${err.slice(-2000)}`)));
  });
}

// ── Still clips (title, sections, outro) ──────────────────────────────
// A still is a 1-frame PNG held for N seconds, transcoded to a clip the
// concat demuxer can glue onto the webcam clips.

async function stillClip({ kind, args, duration, out }) {
  const png = `${out}.png`;
  await run(PY, [path.join(HERE, 'title.py'), kind, png, ...args]);
  await run(FFMPEG, [
    '-y', '-loop', '1', '-t', String(duration), '-i', png,
    '-f', 'lavfi', '-t', String(duration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-c:v', 'libx264', '-r', '30', '-pix_fmt', 'yuv420p', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', out,
  ]);
}

// ── Scene clips ────────────────────────────────────────────────────────

async function sceneClip({ scene, index }) {
  const sessionDir = path.join(workDir, `s${String(index).padStart(2, '0')}`);
  const webm = path.join(sessionDir, 'clip.webm');
  const captionPng = path.join(workDir, `cap${index}.png`);
  const finalMp4 = path.join(workDir, `clip${String(index).padStart(2, '0')}.mp4`);

  // 1. Record the scene through Playwright.
  const session = await newSession({ outDir: sessionDir, token: scene.token });
  try {
    // Install a visible cursor overlay so the recording shows where the
    // pointer is -- Playwright's built-in cursor is hard to see in h.264.
    await session.page.addStyleTag({ content: `
      body { cursor: none !important; }
      .__cursor { position: fixed; width: 18px; height: 18px; border-radius: 999px;
        background: hsl(36 81% 58% / 0.9); box-shadow: 0 0 0 4px hsl(36 81% 58% / 0.25);
        pointer-events: none; z-index: 99999; transform: translate(-50%, -50%);
        transition: transform 80ms linear; }
    ` });
    await session.page.evaluate(() => {
      const el = document.createElement('div');
      el.className = '__cursor';
      document.body.appendChild(el);
      window.__cursorEl = el;
      document.addEventListener('mousemove', (e) => {
        el.style.left = e.clientX + 'px';
        el.style.top = e.clientY + 'px';
        window.__cursor = { x: e.clientX, y: e.clientY };
      }, true);
    });
    try {
      await scene.run(session);
    } catch (e) {
      // A scene throwing on a locator that was not there is just
      // "there was nothing to click" -- record whatever the portal
      // happens to be showing instead, don't break the render.
      log(`    ! scene threw: ${e.message?.split('\n')[0] ?? e}`);
    }
  } finally {
    await endSession(session, webm);
  }

  // 2. Render the caption PNG.
  await run(PY, [path.join(HERE, 'title.py'), 'caption', captionPng, scene.caption ?? '']);

  // 3. Overlay + transcode to MP4.
  // The caption rises from off-screen (y=900) to its resting line
  // (y=710) over the first 0.4s so it never flashes on. ffmpeg's
  // expression evaluator has no `main_duration`, so the fade-out is
  // dropped and the caption just stays for the rest of the clip --
  // in a product demo "a line on screen while the thing is doing it"
  // is what the viewer wants anyway.
  await run(FFMPEG, [
    '-y',
    '-i', webm,
    '-loop', '1', '-i', captionPng,
    '-f', 'lavfi', '-t', '600', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex',
      '[0:v]fps=30,format=yuv420p,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2[v];' +
      "[1:v]format=rgba[cap];" +
      "[v][cap]overlay=x=0:y='if(lt(t,0.4), 900-475*t, 710)':shortest=1[out]",
    '-map', '[out]', '-map', '2:a',
    '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', finalMp4,
  ]);

  await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  await fs.promises.rm(captionPng, { force: true }).catch(() => {});
  return finalMp4;
}

// ── Running ────────────────────────────────────────────────────────────

log(`${def.scenes.length} scenes, ${def.sections.length} sections`);

const parts = [];

// Intro
const introClip = path.join(workDir, 'aa-intro.mp4');
await stillClip({ kind: 'intro', args: [def.title, def.subtitle, def.tierLabel ?? 'Nayaverse Clinic'], duration: 5, out: introClip });
parts.push(introClip);

let sectionIndex = 0;
let sceneIndex = 0;
const sectionAt = new Map(def.scenes.map((s, i) => [s.id, i]).filter(([id, i], _, arr) => arr.findIndex(([, j]) => j === i) === arr.findIndex(([, j]) => j === i)));

for (const scene of def.scenes) {
  // If this scene opens a new section, drop a section card first.
  const openingSection = def.sections.find((s) => s.at === scene.id);
  if (openingSection) {
    sectionIndex++;
    const sectionClip = path.join(workDir, `bb-sec${sectionIndex}.mp4`);
    log(`  section ${sectionIndex}: ${openingSection.title}`);
    await stillClip({ kind: 'section', args: [String(sectionIndex), openingSection.title, openingSection.lede], duration: 3.5, out: sectionClip });
    parts.push(sectionClip);
  }

  sceneIndex++;
  log(`  scene ${sceneIndex}: ${scene.id} — ${scene.caption}`);
  const clip = await sceneClip({ scene, index: sceneIndex });
  parts.push(clip);
}

// Outro
const outroClip = path.join(workDir, 'zz-outro.mp4');
await stillClip({ kind: 'outro', args: [def.outroTitle ?? 'Thank you', def.outroSubtitle ?? 'That is the clinic plan.'], duration: 5, out: outroClip });
parts.push(outroClip);

// Concat demuxer
const listPath = path.join(workDir, 'list.txt');
await fs.promises.writeFile(listPath, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
const finalPath = path.join(HERE, 'out', `${tier}.mp4`);
await run(FFMPEG, [
  '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
  '-c', 'copy', '-movflags', '+faststart', finalPath,
]);

const size = (await fs.promises.stat(finalPath)).size;
log(`✓ ${(size / 1024 / 1024).toFixed(1)} MB → ${finalPath}`);
