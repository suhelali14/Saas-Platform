#!/usr/bin/env node
/**
 * The assistant's advert, recorded from the real portal.
 *
 *   python scripts/demo-video/assistant-voices.py scripts/demo-video/out/_ad_assistant
 *   python scripts/demo-video/tts.py scripts/demo-video/ads/assistant.md scripts/demo-video/out/_audio_assistant
 *   node scripts/demo-video/assistant-ad.mjs                 # everything
 *   node scripts/demo-video/assistant-ad.mjs --only call     # re-record one scene
 *   node scripts/demo-video/assistant-ad.mjs --compose       # no recording, cut again
 *
 * Unlike the plan adverts (render-ad.mjs), a scene here is not "go to a
 * screen and ring something". The assistant is something you talk to, so
 * each scene does the work for real: it types a request and waits for the
 * card, or it opens the microphone and plays a voice into it. The two
 * spoken scenes use Chrome's fake microphone, fed the WAVs made by
 * assistant-voices.py, so the speech goes through the same code and the
 * same speech service a real microphone would. Nothing on screen is
 * drawn in afterwards except the captions.
 *
 * It changes records (a patient is registered, a payment taken), so it is
 * pointed at a local throwaway clinic and never at a real one:
 *   WEB_URL (default http://localhost:5173), API_URL (default :4100).
 *
 * Output: out/assistant-ad.mp4 (1440x900, the whole advert) and one
 * out/assistant-<scene>.mp4 per feature. With --web, a smaller copy of
 * each feature's film and a poster go to the website's public/video.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { glide, glideTo, clickWith, typeInto, beat } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG_PATH ?? 'C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe';
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:4100/api/clinic';
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(WEB) && !process.env.ALLOW_REMOTE) {
  console.error(`This advert saves records as it is filmed. ${WEB} is not a local clinic; set ALLOW_REMOTE=1 only for a demo clinic that resets.`);
  process.exit(2);
}
const VIEW = { width: 1440, height: 900 };
// Made-up people already waiting in the test clinic's queue. Filming a
// scene twice changes their records (a bill is paid once), so a re-film
// may need the next name. The new patient's name is in assistant-voices.py.
const PAYS = process.env.AD_PAYS ?? 'Ayesha Shaikh';
const REFUSED = process.env.AD_REFUSED ?? 'Ganesh More';
const CONSULTS = process.env.AD_CONSULTS ?? 'Mahesh Jagtap';
const STAGE = path.join(HERE, 'out/_ad_assistant');
const AUDIO = path.join(HERE, 'out/_audio_assistant');
const SHOTS = path.join(HERE, 'out/modules-assistant');
fs.mkdirSync(STAGE, { recursive: true });

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const composeOnly = args.includes('--compose');
const forWeb = args.includes('--web');

const narration = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8')).lines;
const voices = JSON.parse(fs.readFileSync(path.join(STAGE, 'voices.json'), 'utf8'));
const line = (scene) => {
  const l = narration.find((n) => n.scene === scene);
  if (!l) throw new Error(`no narration for ${scene}`);
  return l;
};
const wavSeconds = (name) => { const last = voices[name].at(-1); return last.at + last.duration; };

function ff(argv, what) {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...argv], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${what}`);
}
function seconds(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}
function card(kind, out, ...words) {
  const r = spawnSync('python', [path.join(HERE, 'ad-cards.py'), kind, out, ...words], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`card ${kind} failed`);
  return out;
}

// ── Signing in ────────────────────────────────────────────────────────
// One sign-in per person for the whole run: the portal allows a login on
// one device at a time, and five sign-ins a minute.
const tokens = {};
async function tokenFor(who) {
  if (tokens[who]) return tokens[who];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${who}@demo.nayaverse.in`, password: 'nayaverse-demo' }) });
    if (r.ok) return (tokens[who] = (await r.json()).token);
    if (r.status !== 429) throw new Error(`login ${who}: ${r.status}`);
    await beat(66_000);
  }
  throw new Error(`login ${who} kept being refused`);
}
async function get(who, route) {
  const r = await fetch(API + route, { headers: { authorization: `Bearer ${await tokenFor(who)}` } });
  return r.json();
}

// ── One recorded scene ────────────────────────────────────────────────
/**
 * Opens the portal as `who`, records, and hands the scene a clock. The
 * scene calls `mark(name)` at moments the cut needs (when the microphone
 * opened, when the note appeared). Returns the clip and its marks, all in
 * seconds from the first frame kept.
 */
async function record(name, who, microphone, play) {
  const dir = path.join(STAGE, `_raw-${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--hide-scrollbars', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      ...(microphone ? [`--use-file-for-fake-audio-capture=${path.join(STAGE, microphone)}%noloop`] : [])],
  });
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, recordVideo: { dir, size: VIEW }, permissions: ['microphone'] });
  await context.addInitScript((tk) => { try { localStorage.setItem('clinicAccessToken', tk); localStorage.setItem('clinicTheme', 'light'); } catch { /* private window */ } }, await tokenFor(who));
  const page = await context.newPage();
  const filmedFrom = Date.now();
  page.on('pageerror', (e) => console.error('   page error:', e.message));
  let keptFrom = 0;
  let flashedAt = 0;
  const marks = {};
  const now = () => (Date.now() - filmedFrom) / 1000;
  const scene = {
    page,
    /**
     * Everything before this is loading, and is cut away. The recorder's
     * clock does not start when ours does (it starts at the page's first
     * painted frame, seconds later on a slow load), so the screen is
     * flashed one colour for a moment here; the cut finds that flash in
     * the recording and learns the difference. The flash itself is in
     * the part that is cut away.
     */
    begin: async () => {
      await page.evaluate(() => { const d = document.createElement('div'); d.id = '__sync'; d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#ff00ff'; document.body.appendChild(d); });
      flashedAt = now();
      await beat(400);
      await page.evaluate(() => document.getElementById('__sync')?.remove());
      await beat(700);
      keptFrom = now();
    },
    mark: (m) => { marks[m] = +(now() - keptFrom).toFixed(2); return marks[m]; },
    clock: () => now() - keptFrom,
    /** A sharp still of this moment, for the animated story (reel/story-assistant.json). */
    shot: async (as) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${as}.png`) }); },
  };
  let failed = null;
  try { await play(scene); } catch (e) { failed = e; }
  const length = now() - keptFrom;
  await page.close(); await context.close(); await browser.close();
  if (failed) throw failed;
  const webm = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
  const clip = path.join(STAGE, `clip-${name}.mp4`);
  const late = flashIn(path.join(dir, webm)) - flashedAt;
  console.log(`   ${name}: the recording's clock is ${late.toFixed(2)}s from ours`);
  // The seek goes after the input: these recordings have no index, and a
  // seek before the input lands seconds away from where it was asked to.
  ff(['-i', path.join(dir, webm), '-ss', (keptFrom + late).toFixed(2), '-t', length.toFixed(2),
    '-vf', `fps=30,scale=${VIEW.width}:${VIEW.height},format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-r', '30', '-an', clip], `clip ${name}`);
  fs.writeFileSync(path.join(STAGE, `clip-${name}.json`), JSON.stringify({ marks, length: seconds(clip) }, null, 2));
  console.log(`   ${name}: ${seconds(clip).toFixed(1)}s`, marks);
}

/** When the sync flash first shows in a recording, in seconds. */
function flashIn(webm) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,scale=1:1,format=rgb24', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  const px = r.stdout;
  for (let i = 0; i + 2 < px.length; i += 3) if (px[i] > 200 && px[i + 1] < 90 && px[i + 2] > 200) return i / 3 / 30;
  throw new Error(`no sync flash found in ${webm}`);
}

const bar = (page) => page.locator('form input[placeholder]').last();
/** Types a request into the assistant's bar and sends it, then waits for what comes back. */
async function ask(page, words) {
  await typeInto(page, bar(page), words, { perChar: 38 });
  const answered = page.waitForResponse((r) => /\/assistant\/ask$/.test(r.url()), { timeout: 30_000 });
  await page.keyboard.press('Enter');
  await answered;
  await beat(600);
}
async function holdUntil(scene, t) { const left = t - scene.clock(); if (left > 0) await beat(left * 1000); }

// ── The scenes ────────────────────────────────────────────────────────
const SCENES = {
  // The doctor taps once and says four things. A request, a correction to
  // it, a yes, and a question.
  call: () => record('call', 'doctor', 'call.wav', async (s) => {
    const { page } = s;
    await page.goto(`${WEB}/queue`, { waitUntil: 'networkidle' });
    await beat(900);
    await s.begin();
    const mic = page.getByRole('button', { name: /Tap, say what you need/ });
    await beat(line('call').duration * 1000 - 1400);
    await glideTo(page, mic, { dur: 900 });
    await beat(350);
    await s.shot('call-before');
    let heard = 0;
    page.on('response', (r) => {
      if (!r.url().endsWith('/assistant/voice')) return;
      const as = ['call-card', 'call-fixed', 'call-done', 'call-next'][heard++];
      if (as) setTimeout(() => s.shot(as).catch(() => {}), 900);
    });
    await mic.click();
    await page.getByRole('button', { name: 'Listening. Tap to stop.' }).waitFor();
    const opened = s.mark('mic');
    setTimeout(() => s.shot('call-listening').catch(() => {}), 2500);
    await holdUntil(s, opened + wavSeconds('call') + 5.5);
    const stop = page.getByRole('button', { name: 'Listening. Tap to stop.' });
    if (await stop.count()) await clickWith(page, stop);
    await beat(1200);
  }),

  hindi: () => record('hindi', 'reception', null, async (s) => {
    const { page } = s;
    await page.goto(`${WEB}/queue`, { waitUntil: 'networkidle' });
    await beat(900);
    await s.begin();
    await beat(500);
    await ask(page, 'aaj ka collection kitna hua?');
    s.mark('answered');
    await s.shot('hindi-answer');
    await holdUntil(s, Math.max(line('hindi').duration + 0.8, s.clock() + 3.2));
  }),

  payment: () => record('payment', 'reception', null, async (s) => {
    const { page } = s;
    await page.goto(`${WEB}/queue`, { waitUntil: 'networkidle' });
    await beat(900);
    await s.begin();
    await beat(500);
    await ask(page, `${PAYS} paid 400 by UPI`);
    s.mark('card');
    await beat(900);
    await s.shot('pay-card');
    await beat(900);
    const yes = page.getByRole('log').getByRole('button', { name: 'Confirm', exact: true }).first();
    const done = page.waitForResponse((r) => /\/assistant\/run$/.test(r.url()), { timeout: 30_000 });
    await clickWith(page, yes, { pre: 350, post: 0 });
    await done;
    s.mark('done');
    await beat(700);
    await s.shot('pay-done');
    await holdUntil(s, Math.max(line('payment').duration + 0.8, s.clock() + 3.0));
  }),

  limits: () => record('limits', 'pharmacy', null, async (s) => {
    const { page } = s;
    await page.goto(`${WEB}/pharmacy`, { waitUntil: 'networkidle' });
    await beat(900);
    await s.begin();
    await beat(500);
    await ask(page, `take 400 from ${REFUSED} by UPI`);
    s.mark('refused');
    await s.shot('limits-refused');
    await holdUntil(s, Math.max(line('limits').duration + 0.8, s.clock() + 3.4));
  }),

  // A doctor and a patient talk; the assistant writes the visit up. One
  // recording carries both narrator lines: listening, then the draft.
  consult: () => record('consult', 'doctor', 'consult.wav', async (s) => {
    const { page } = s;
    const visits = (await get('doctor', '/appointments')).data ?? [];
    const visit = visits.find((v) => new RegExp(CONSULTS, 'i').test(v.patient?.name ?? v.patientName ?? '')) ?? visits.find((v) => ['CHECKED_IN', 'IN_PROGRESS', 'WAITING'].includes(v.status));
    if (!visit) throw new Error('no visit to open for the consultation scene');
    await page.goto(`${WEB}/appointments/${visit.id}/encounter`, { waitUntil: 'networkidle' });
    await beat(1200);
    await s.begin();
    await beat(700);
    await clickWith(page, page.getByText('The patient agrees to this visit being listened to.'), { pre: 250, post: 500 });
    await holdUntil(s, line('consult').duration - 0.9);
    await clickWith(page, page.getByRole('button', { name: 'Listen to the consultation', exact: true }), { pre: 300, post: 0 });
    await page.getByRole('button', { name: 'Stop and check the note' }).waitFor();
    const opened = s.mark('mic');
    await holdUntil(s, opened + wavSeconds('consult') + 0.9);
    await s.shot('consult-listening');
    await beat(600);
    await clickWith(page, page.getByRole('button', { name: 'Stop and check the note' }), { pre: 300, post: 0 });
    s.mark('stopped');
    await page.getByRole('button', { name: 'Confirm and save' }).waitFor({ timeout: 90_000 });
    s.mark('draft');
    await beat(1200);
    await s.shot('consult-draft');
    // Read down the draft the way a doctor would before pressing Confirm.
    await glide(page, { x: 900, y: 520 }, { dur: 500 });
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 170); await beat(1100); }
    await s.shot('consult-draft-end');
    await beat(1800);
    // The draft is left unsaved on purpose: the advert says "for the doctor
    // to check", and pressing Confirm for them would show the opposite.
    const discard = page.getByRole('button', { name: 'Discard' });
    s.mark('end');
    if (await discard.count()) await discard.click().catch(() => {});
  }),
};

// ── What is said over each scene, and what is written under it ────────
/** A caption under the picture: [from, to, main words, small words]. */
function plan(name, meta) {
  const m = meta.marks;
  const say = (scene, at = 0.3) => ({ file: path.join(AUDIO, line(scene).clip), at, len: line(scene).duration, words: line(scene).vo });
  // A long thing said is captioned a sentence or two at a time, each for
  // its share of the time by length, so no caption runs off its band.
  const heard = (wav, who) => voices[wav].flatMap((v) => {
    const sentences = v.words.match(/[^.?!।]+[.?!।]+/g)?.map((x) => x.trim()) ?? [v.words];
    const groups = [];
    for (const x of sentences) {
      if (groups.length && (groups.at(-1) + ' ' + x).length <= 62) groups[groups.length - 1] += ' ' + x;
      else groups.push(x);
    }
    const all = groups.join(' ').length;
    let at = m.mic + v.at;
    return groups.map((g) => {
      const len = v.duration * (g.length / all);
      const piece = { at, len, words: g, who: typeof who === 'function' ? who(v) : who };
      at += len;
      return piece;
    });
  });
  if (name === 'call') {
    const n = say('call');
    return { audio: [n, { file: path.join(STAGE, 'call.wav'), at: m.mic }],
      captions: [[n.at, m.mic - 0.1, 'One tap, and it listens.', 'Say what you need'],
        ...heard('call', 'The doctor, speaking').map((h) => [h.at, h.at + h.len + 2.4, `“${h.words}”`, h.who])] };
  }
  if (name === 'hindi') { const n = say('hindi'); return { audio: [n], captions: [[n.at, meta.length - 0.3, 'English, Hindi or Marathi, the way people mix them.', 'Typed here by the front desk']] }; }
  if (name === 'payment') { const n = say('payment'); return { audio: [n], captions: [[n.at, meta.length - 0.3, 'One sentence, then one yes.', 'Nothing is saved until somebody confirms it']] }; }
  if (name === 'limits') { const n = say('limits'); return { audio: [n], captions: [[n.at, meta.length - 0.3, 'Each login can do only what that person is allowed to.', 'Signed in as the pharmacist']] }; }
  if (name === 'consult') {
    const a = say('consult');
    const b = say('draft', m.draft + 0.4);
    return { audio: [a, { file: path.join(STAGE, 'consult.wav'), at: m.mic }, b],
      // The wait while the note is written is shortened in the cut (see
      // below); captions are placed on the clock of the recording.
      captions: [[a.at, m.mic - 0.1, 'In the consulting room, it listens to the visit.', 'The patient is asked first'],
        ...heard('consult', (v) => (v.voice.startsWith('hi-') ? 'The patient' : 'The doctor')).map((h) => [h.at, h.at + h.len + 0.4, `“${h.words}”`, h.who]),
        [m.stopped + 0.2, m.draft, 'Writing the note…', 'A few seconds'],
        [m.draft + 0.3, m.end - 0.2, 'A draft for the doctor to check.', 'Note, medicines, tests and follow-up. Saved only on Confirm']] };
  }
  throw new Error(name);
}

// ── Run ───────────────────────────────────────────────────────────────
const ORDER = ['call', 'hindi', 'payment', 'limits', 'consult'];
if (!composeOnly) {
  console.log('[1/3] recording…');
  for (const name of ORDER) {
    if (only && !only.includes(name)) continue;
    if (!only && fs.existsSync(path.join(STAGE, `clip-${name}.mp4`))) { console.log(`   ${name}: kept (delete the clip, or --only ${name}, to film it again)`); continue; }
    await SCENES[name]();
  }
}
if (only && !args.includes('--then-compose')) process.exit(0);

console.log('[2/3] cards and captions…');
const still = (key, kind, ...words) => {
  const png = card(kind, path.join(STAGE, `card-${key}.png`), ...words);
  const n = line(`card-${key}`);
  const length = n.duration + 0.9;
  const clip = path.join(STAGE, `cardclip-${key}.mp4`);
  ff(['-loop', '1', '-i', png, '-t', String(length), '-vf', `scale=${VIEW.width * 2}:-1,zoompan=z='min(zoom+0.0005,1.04)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(length * 30)}:s=${VIEW.width}x${VIEW.height}:fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '18', '-r', '30', clip], `card ${key}`);
  return { clip, length: seconds(clip), audio: [{ file: path.join(AUDIO, n.clip), at: 0.35 }] };
};
const parts = [
  still('title', 'title', 'Nayaversse Clinic', 'The assistant', 'A helper inside the clinic’s software. Say it, check it, done.'),
  still('problem', 'problem', 'The doctor types.', 'The desk types.', 'The patient waits.'),
  still('promise', 'promise', 'Now the clinic has an assistant.'),
];
let captionNo = 0;
for (const name of ORDER) {
  const meta = JSON.parse(fs.readFileSync(path.join(STAGE, `clip-${name}.json`), 'utf8'));
  const { audio, captions } = plan(name, meta);
  const inputs = ['-i', path.join(STAGE, `clip-${name}.mp4`)];
  let graph = '[0:v]format=yuv420p[v0]';
  captions.forEach(([from, upTo, main, small], i) => {
    const to = Math.min(upTo, meta.length - 0.1);
    const png = card('lower_third', path.join(STAGE, `cap-${String(captionNo++).padStart(2, '0')}.png`), small ? `${main} | ${small}` : main);
    inputs.push('-loop', '1', '-t', String(meta.length), '-i', png);
    // Captions sit at the top: the assistant's bar and its cards are at the
    // foot of the screen, and a caption there would cover the thing being
    // shown. Each drops 24px into place over a quarter second, and fades.
    const a = from.toFixed(2), b = to.toFixed(2);
    graph += `;[${i + 1}:v]format=rgba,fade=t=in:st=${a}:d=0.25:alpha=1,fade=t=out:st=${(to - 0.25).toFixed(2)}:d=0.25:alpha=1[c${i}]`;
    graph += `;[v${i}][c${i}]overlay=x=0:y='-6-24*max(0,1-(t-${a})/0.25)':enable='between(t,${a},${b})'[v${i + 1}]`;
  });
  const out = path.join(STAGE, `titled-${name}.mp4`);
  ff([...inputs, '-filter_complex', graph, '-map', `[v${captions.length}]`, '-t', String(meta.length), '-c:v', 'libx264', '-crf', '18', '-r', '30', out], `captions ${name}`);
  parts.push({ clip: out, length: seconds(out), audio });
  // The same scene on its own, with its sound: one feature, one short film.
  // The website shows these one by one beside what each feature is.
  const alone = path.join(HERE, `out/assistant-${name}.mp4`);
  const sound = audio.map((a, i) => `[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(a.at * 1000)}:all=1[s${i}]`).join(';')
    + `;${audio.map((_, i) => `[s${i}]`).join('')}amix=inputs=${audio.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad[a]`;
  ff(['-i', out, ...audio.flatMap((a) => ['-i', a.file]), '-filter_complex', sound, '-map', '0:v', '-map', '[a]', '-t', String(meta.length),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', alone], `alone ${name}`);
  if (forWeb) {
    const site = path.join(HERE, '../../apps/nayaverse-web/public/video');
    fs.mkdirSync(site, { recursive: true });
    ff(['-i', alone, '-vf', 'scale=1280:800', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '72k', '-ac', '1', '-movflags', '+faststart', path.join(site, `assistant-${name}.mp4`)], `web ${name}`);
    // The poster is the moment the feature has just done its work.
    const m = meta.marks;
    const shown = { call: m.mic + voices.call[1].at - 0.3, hindi: meta.length - 0.5, payment: m.card + 1.2, limits: meta.length - 0.5, consult: (m.draft ?? 0) + 2.5 }[name];
    ff(['-i', path.join(STAGE, `clip-${name}.mp4`), '-ss', Math.min(shown, meta.length - 0.3).toFixed(2), '-frames:v', '1', '-vf', 'scale=1280:800', '-q:v', '5', path.join(site, `assistant-${name}.jpg`)], `poster ${name}`);
    console.log(`   web: assistant-${name}.mp4 ${(fs.statSync(path.join(site, `assistant-${name}.mp4`)).size / 1e6).toFixed(1)} MB`);
  }
}
parts.push(
  still('proof', 'outro', 'The real product.', 'Every second was recorded from it. In trial now.'),
  still('cta', 'outro', 'Ask for a walkthrough.', 'nayaversse.in'),
);

console.log('[3/3] joining, and laying the sound under it…');
const X = 0.45;
let graph = '[0:v]setpts=PTS-STARTPTS[x0]';
let at = 0;
const starts = [0];
for (let i = 1; i < parts.length; i++) {
  at += parts[i - 1].length - X;
  starts.push(at);
  graph += `;[${i}:v]setpts=PTS-STARTPTS[p${i}];[x${i - 1}][p${i}]xfade=transition=fade:duration=${X}:offset=${at.toFixed(3)}[x${i}]`;
}
const total = at + parts.at(-1).length;
const sounds = parts.flatMap((p, i) => p.audio.map((a) => ({ file: a.file, at: starts[i] + a.at })));
const mix = sounds.map((s, i) => `[${parts.length + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(s.at * 1000)}:all=1[s${i}]`).join(';');
graph += `;${mix};${sounds.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sounds.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad[aout]`;
const final = path.join(HERE, 'out/assistant-ad.mp4');
ff([...parts.flatMap((p) => ['-i', p.clip]), ...sounds.flatMap((s) => ['-i', s.file]),
  '-filter_complex', graph, '-map', `[x${parts.length - 1}]`, '-map', '[aout]', '-t', total.toFixed(2),
  '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final], 'final');
console.log(`\n done: ${final}  (${(total / 60) | 0}:${String(Math.round(total % 60)).padStart(2, '0')})`);

