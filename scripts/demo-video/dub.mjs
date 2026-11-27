#!/usr/bin/env node
/**
 * Dub a voice-over on top of an existing tier MP4.
 *
 * Takes the manifest.json from tts.py (line timings + clip durations)
 * and the existing tier video, writes <out>/<tier>-ad.mp4 with the
 * voice-over mixed over the footage.
 *
 * The manifest's `hold` tells us the gap after each line: so the voice
 * lines are laid down at:
 *   start_i = sum_{j<i} (duration_j + gap_j)
 *
 * This is intentionally the fastest path to a dubbed video. A richer
 * ad-cut (fresh footage, b-roll per line, overlays) comes later.
 *
 * Usage:
 *   node dub.mjs out/_audio_clinic out/clinic.mp4 out/clinic-ad.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = 'C:/Users/Suhelali/OneDrive/Desktop/nayaverse-studio/node_modules/ffmpeg-static/ffmpeg.exe';

const [audioDir, videoIn, videoOut] = process.argv.slice(2);
if (!audioDir || !videoIn || !videoOut) {
  console.error('usage: node dub.mjs <audio_dir> <video_in> <video_out>');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, 'manifest.json'), 'utf-8'));

// Gap after each line: hold minus the line itself if positive, else a
// short beat so lines don't crash into each other.
const MIN_GAP = 0.35;
const timings = [];
let t = 2.0; // small lead-in so the voice does not start on the cut
for (const line of manifest.lines) {
  const gap = Math.max(MIN_GAP, line.hold - line.duration);
  timings.push({ ...line, start: t });
  t += line.duration + gap;
}
const totalAudio = t;
console.log(`voice-over runs ${totalAudio.toFixed(1)}s across ${timings.length} lines`);

// ffmpeg: input the base video, input each voice clip, use adelay to
// place each one at its start, amix to combine. The base video's own
// audio (if any -- Playwright captures silent) is replaced.
const inputs = ['-i', videoIn];
for (const line of timings) inputs.push('-i', path.join(audioDir, line.clip));

// adelay wants milliseconds, two channels (stereo).
const delays = timings.map((line, i) => {
  const ms = Math.round(line.start * 1000);
  return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`;
}).join(';');
const mix = `${timings.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timings.length}:duration=longest:dropout_transition=0,volume=1.6[voice]`;
const filter = `${delays};${mix}`;

const args = [
  '-y', '-hide_banner',
  ...inputs,
  '-filter_complex', filter,
  '-map', '0:v', '-map', '[voice]',
  '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '160k',
  '-shortest',
  videoOut,
];

const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`wrote ${videoOut}`);
