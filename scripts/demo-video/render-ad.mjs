#!/usr/bin/env node
/**
 * Render an ad-shaped video for one tier.
 *
 *   DEMO=demo-clinic node scripts/demo-video/render-ad.mjs clinic
 *
 * This is the long-form renderer: a per-line fresh Playwright capture,
 * a soft Ken Burns zoom and amber highlight on the target, a lower-third
 * caption, crossfade transitions, and the voice track from tts.py mixed
 * on top. Not the dub-on-top-of-walkthrough shortcut -- this is the one
 * where each voice line has its own tight shot.
 *
 * Inputs:
 *   ads/<tier>.recipe.mjs  -- per-line scene + target selector
 *   ads/<tier>.md          -- voice script (table); tts.py manifest is already generated
 *   out/_audio_<tier>/manifest.json
 *
 * Output:
 *   out/<tier>-ad-pro.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { newSession, endSession, tokenFor, goto, beat, highlight, zoomInto, glide, clickWith } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = 'C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe';
const PY = 'python';

const tier = process.argv[2];
if (!tier) { console.error('usage: node render-ad.mjs <tier>'); process.exit(2); }

const recipeUrl = pathToFileURL(path.join(HERE, 'ads', `${tier}.recipe.mjs`)).href;
const recipe = (await import(recipeUrl)).default;

if (recipe.demo && !process.env.DEMO) process.env.DEMO = recipe.demo;
const audioDir = path.resolve(HERE, `out/_audio_${tier}`);
if (!fs.existsSync(path.join(audioDir, 'manifest.json'))) {
  console.error(`no voice manifest at ${audioDir}/manifest.json -- run tts.py first`);
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, 'manifest.json'), 'utf-8'));
if (manifest.lines.length !== recipe.lines.length) {
  console.error(`voice has ${manifest.lines.length} lines but recipe has ${recipe.lines.length}`);
  process.exit(2);
}

const stageDir = path.resolve(HERE, recipe.outDir);
fs.mkdirSync(stageDir, { recursive: true });

// ── 1. Still cards -----------------------------------------------------
console.log('[1/5] rendering still cards...');
function makeCard(args) {
  const r = spawnSync(PY, [path.join(HERE, 'ad-cards.py'), ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ad-cards.py ${args[0]} failed`);
}
const titleCards = { opening: null, problem: null, promise: null, proof: null, cta: null };
const titleArgs = {
  opening: ['title',   path.join(stageDir, 'card-opening.png'), recipe.title.eyebrow, recipe.title.main, recipe.title.sub],
  promise: ['promise', path.join(stageDir, 'card-promise.png'), 'Nayaverse runs this clinic.'],
  proof:   ['outro',   path.join(stageDir, 'card-proof.png'),   'Captured from the real product.', 'Running today.'],
  cta:     ['outro',   path.join(stageDir, 'card-cta.png'),     recipe.outro.main, recipe.outro.sub],
};
// For the "problem" card, split the voice line heuristically on sentences.
const problemVO = manifest.lines[1].vo;
const parts = problemVO.split('. ').map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);
while (parts.length < 3) parts.push('');
titleArgs.problem = ['problem', path.join(stageDir, 'card-problem.png'), parts[0], parts[1], parts[2]];
for (const [k, args] of Object.entries(titleArgs)) {
  makeCard(args);
  titleCards[k] = args[1];
}

// ── 2. Lower-third captions ------------------------------------------
console.log('[2/5] rendering captions...');
const capPaths = manifest.lines.map((line, i) => {
  const out = path.join(stageDir, `cap-${String(i).padStart(2, '0')}.png`);
  // Caption is a tightened version of the voice line: the voice already
  // said it, so the lower-third is a reinforcer, not a repeat.
  const cap = shortCaption(line.vo);
  makeCard(['lower_third', out, cap]);
  return out;
});
function shortCaption(vo) {
  // First sentence, or first 80 chars; whichever is shorter.
  const firstStop = vo.search(/[.!?](\s|$)/);
  const sentence = firstStop > 0 ? vo.slice(0, firstStop + 1).trim() : vo;
  return sentence.length > 90 ? sentence.slice(0, 87).trim() + '…' : sentence;
}

// ── 3. Scene captures -------------------------------------------------
console.log('[3/5] capturing scenes...');
const token = await tokenFor(recipe.login);
const clipPaths = [];
for (let i = 0; i < recipe.lines.length; i++) {
  const line = recipe.lines[i];
  const voiceDur = manifest.lines[i].duration;
  // The clip is at least as long as the voice line plus a half-second
  // lead-out so the caption has room to fade.
  const clipDur = Math.max(3.0, voiceDur + 0.6);
  const clipOut = path.join(stageDir, `clip-${String(i).padStart(2, '0')}.mp4`);
  clipPaths.push(clipOut);
  // Idempotent: if a prior pass wrote this clip, keep it. Delete the
  // file to re-record. Scene capture is the slow part (remote demo),
  // worth preserving across runs while tuning the composite steps.
  if (fs.existsSync(clipOut)) {
    console.log(`  ${i} (cached) ${line.kind} ${clipDur.toFixed(1)}s`);
    continue;
  }
  if (line.kind !== 'web') {
    // Still card: just loop the PNG for clipDur seconds.
    const card = titleCards[line.variant] ?? titleCards.opening;
    const r = spawnSync(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-loop', '1', '-i', card,
      '-t', String(clipDur),
      '-vf', `fps=30,scale=1440:900,zoompan=z='min(zoom+0.0008,1.04)':d=${Math.round(clipDur * 30)}:s=1440x900:fps=30,format=yuv420p`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
      clipOut,
    ], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`card clip ${i} failed`);
    console.log(`  ${i} card.${line.variant} ${clipDur.toFixed(1)}s`);
    continue;
  }
  const rawDir = path.join(stageDir, `_raw-${String(i).padStart(2, '0')}`);
  fs.mkdirSync(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, 'scene.webm');
  const session = await newSession({ outDir: rawDir, token });
  try {
    await goto(session.page, line.route);
    await beat(line.wait ?? 1500);
    if (line.clickButton) {
      const b = session.page.getByRole('button', { name: line.clickButton }).first();
      if (await b.count().catch(() => 0)) await clickWith(session.page, b);
      await beat(line.afterClickWait ?? 1500);
    }
    if (line.thenClickButton) {
      const b2 = session.page.getByRole('button', { name: line.thenClickButton }).first();
      if (await b2.count().catch(() => 0)) await clickWith(session.page, b2);
      await beat(line.afterClickWait ?? 1500);
    }
    if (line.clickFirst) {
      const first = session.page.locator(line.clickFirst).first();
      if (await first.count().catch(() => 0)) await clickWith(session.page, first);
      await beat(line.afterClickWait ?? 1500);
    }
    // Pick the thing to focus on: target selector, text, or placeholder.
    let locator = null;
    if (line.target) locator = session.page.locator(line.target).first();
    else if (line.targetText) locator = session.page.getByText(line.targetText).first();
    else if (line.targetPlaceholder) locator = session.page.getByPlaceholder(line.targetPlaceholder).first();
    if (locator && (await locator.count().catch(() => 0))) {
      // Run the ring and the zoom in parallel -- the ring lands first, the
      // scale finishes a touch later, the whole thing feels like one motion.
      await Promise.all([
        highlight(session.page, locator, { hold: Math.min(2800, (clipDur - 0.8) * 1000) }),
        line.zoom ? zoomInto(session.page, locator, line.zoom) : beat((clipDur - 0.8) * 1000),
      ]);
    } else {
      await beat((clipDur - 0.6) * 1000);
    }
  } catch (err) {
    console.error(`  ${i} scene error: ${err.message}`);
  }
  await endSession(session, rawPath);
  // Transcode WebM to MP4, apply a slow Ken Burns on top of the recorded
  // motion so the clip is never sitting still for the full voice line.
  const r = spawnSync(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', rawPath,
    '-t', String(clipDur),
    '-vf', `fps=30,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    clipOut,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`clip ${i} transcode failed`);
  console.log(`  ${i} web.${line.route} ${clipDur.toFixed(1)}s`);
}

// ── 4. Overlay lower-thirds on each clip ------------------------------
console.log('[4/5] overlaying lower-thirds...');
const dubbedClips = [];
for (let i = 0; i < clipPaths.length; i++) {
  const inp = clipPaths[i];
  const cap = capPaths[i];
  const voiceDur = manifest.lines[i].duration;
  const dubPath = path.join(stageDir, `dubbed-${String(i).padStart(2, '0')}.mp4`);
  dubbedClips.push(dubPath);
  // Slide the caption in at 0.3s, hold until 0.5s before the clip ends,
  // slide out. 150px tall band anchored at y=720 (below of 900).
  // The caption PNG is a single-frame still -- it must be looped to the
  // clip's length, or overlay with shortest=1 cuts the whole output to
  // a single frame (~0.03s). Load with -loop 1 -t <clipDur>, drop
  // shortest, and the video is bounded by the video input instead.
  const filter = `[0:v]fps=30,format=yuv420p[v];` +
                 `[1:v]format=rgba[cap];` +
                 `[v][cap]overlay=x=0:y='if(lt(t,0.4), 900-500*t*2, if(gt(t,${voiceDur - 0.1}), 900-500+500*(t-${voiceDur - 0.1})*2, 720))'[out]`;
  const r = spawnSync(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', inp,
    '-loop', '1', '-t', String(voiceDur + 0.6), '-i', cap,
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
    dubPath,
  ], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`overlay ${i} failed`);
}

// ── 5. Concat with crossfade, add voice-over -------------------------
console.log('[5/5] concat + voice mix...');
// Build a filter_complex with chained crossfades. Each clip's duration is
// read above -- we need it for xfade's `offset`.
const clipDurs = [];
for (let i = 0; i < dubbedClips.length; i++) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', dubbedClips[i]], { encoding: 'utf-8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  const dur = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 5;
  clipDurs.push(dur);
}
const XFADE = 0.5;
let xfadeChain = '[0:v]setpts=PTS-STARTPTS[v0];';
let acc = clipDurs[0];
let prev = 'v0';
for (let i = 1; i < dubbedClips.length; i++) {
  const offset = acc - XFADE;
  xfadeChain += `[${i}:v]setpts=PTS-STARTPTS[v${i}];`;
  xfadeChain += `[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[mix${i}];`;
  prev = `mix${i}`;
  acc = acc + clipDurs[i] - XFADE;
}
xfadeChain += `[${prev}]format=yuv420p[vout]`;

// Voice track: concat MP3s with the same delay math as dub.mjs, but using
// clip timing (the clips are now the exact length of their voice line + lead-out),
// so each line starts at the beginning of its clip after a 0.25s beat.
const audioInputs = [];
const audioDelays = [];
let t = 0.25; // small lead on the title card
for (let i = 0; i < manifest.lines.length; i++) {
  const line = manifest.lines[i];
  audioInputs.push('-i', path.join(audioDir, line.clip));
  audioDelays.push({ idx: i, delayMs: Math.round(t * 1000) });
  t += clipDurs[i] - XFADE; // each line starts when the previous clip's
                            // body ends (not during the crossfade)
}

const audioN = manifest.lines.length;
const videoN = dubbedClips.length;
let audioFilter = audioDelays.map((d) => {
  const inputIndex = videoN + d.idx; // audio inputs come after video inputs
  return `[${inputIndex}:a]adelay=${d.delayMs}|${d.delayMs}[da${d.idx}]`;
}).join(';');
audioFilter += ';' + audioDelays.map((d) => `[da${d.idx}]`).join('') +
               `amix=inputs=${audioN}:duration=longest:dropout_transition=0,volume=1.5[aout]`;

const fullFilter = xfadeChain + ';' + audioFilter;

const videoInputs = dubbedClips.flatMap((p) => ['-i', p]);
const finalOut = path.resolve(HERE, `out/${tier}-ad-pro.mp4`);
const r = spawnSync(FFMPEG, [
  '-y', '-hide_banner',
  ...videoInputs,
  ...audioInputs,
  '-filter_complex', fullFilter,
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k',
  '-shortest',
  finalOut,
], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('final concat failed');

console.log(`\n done: ${finalOut}`);
