/**
 * The shared pieces every tier uses: Playwright setup, signing in, moving
 * the mouse the way a person moves one (a short glide rather than a
 * teleport), recording one scene to its own WebM so the compositor can
 * caption and arrange each one on its own.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

// Point the recorder at a deployed demo by setting `DEMO`:
//   DEMO=demo-clinic         -> https://demo-clinic.portal.nayaverse.in
//   DEMO=demo-multispecialty -> https://demo-multispecialty.portal.nayaverse.in
// Unset falls back to the local dev stack. Read lazily, not at import
// time -- the renderer may set DEMO after lib is first loaded.
export const web = () => process.env.DEMO
  ? `https://${process.env.DEMO}.portal.nayaverse.in`
  : 'http://localhost:5176';
export const api = () => process.env.DEMO
  ? `https://${process.env.DEMO}.api.nayaverse.in/api/clinic`
  : 'http://localhost:4100/api/clinic';
// Kept for scripts that imported these as constants.
export const WEB = web();
export const API = api();
export const VIEWPORT = { width: 1440, height: 900 };
export const PASSWORD = 'nayaverse-demo';

/**
 * Sign-in that waits out the 5-per-minute rate limit. Each tier opens
 * several accounts; if one trips the limit, we wait the window out and
 * try once more rather than killing the whole render.
 */
export async function tokenFor(email, { tries = 3 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${api()}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
    if (r.ok) return (await r.json()).token;
    const body = await r.text();
    if (r.status === 429) {
      // "Too many attempts. Try again in NN seconds." — read the wait off
      // the message when the server supplies it.
      const m = body.match(/(\d+)\s*seconds/);
      const wait = (m ? Number(m[1]) : 65) * 1000 + 1500;
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    throw new Error(`login ${email} ${r.status} ${body}`);
  }
  throw new Error(`login ${email} failed after ${tries} tries`);
}

/**
 * Opens a browser context recording to an mp4-sized WebM. The recording
 * starts the moment the context opens and stops when it closes, so every
 * scene gets its own context and its own clip.
 */
export async function newSession({ outDir, token, theme = 'light' }) {
  await fs.promises.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--hide-scrollbars'] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: VIEWPORT },
    reducedMotion: 'reduce', // avoids flashy entrance animations during the demo
  });
  await context.addInitScript((tk) => {
    try { localStorage.setItem('clinicAccessToken', tk); localStorage.setItem('clinicTheme', 'light'); } catch { /* empty */ }
  }, token);
  if (theme === 'dark') await context.addInitScript(() => { try { localStorage.setItem('clinicTheme', 'dark'); } catch { /* empty */ } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  return { browser, context, page };
}

export async function endSession({ browser, context, page }, finalPath) {
  await page.close();
  await context.close();
  await browser.close();
  // Playwright writes the video to a random name; rename it to what the orchestrator asked for.
  const dir = path.dirname(finalPath);
  const made = (await fs.promises.readdir(dir)).find((f) => f.endsWith('.webm') && f !== path.basename(finalPath));
  if (made) await fs.promises.rename(path.join(dir, made), finalPath);
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Moves the mouse along a short ease-in-out curve to (x, y). People do
 * not teleport the pointer, and the curve makes the recording feel like
 * a real user working, not a selenium script.
 */
export async function glide(page, to, { dur = 420, steps = 24 } = {}) {
  const from = await page.evaluate(() => {
    // Playwright does not report the last mouse position, so we remember
    // it ourselves on `window`.
    return window.__cursor ?? { x: 20, y: 20 };
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;
    await page.mouse.move(x, y);
    await sleep(dur / steps);
  }
  await page.evaluate((pos) => { window.__cursor = pos; }, to);
}

export async function glideTo(page, locator, { dur = 420, offset = { x: 0.5, y: 0.5 } } = {}) {
  let box;
  try { box = await locator.boundingBox({ timeout: 3000 }); } catch { return false; }
  if (!box) return false;
  await glide(page, { x: box.x + box.width * offset.x, y: box.y + box.height * offset.y }, { dur });
  return true;
}

export async function clickWith(page, locator, { pre = 300, post = 500 } = {}) {
  // Missing clicks are swallowed: the demo moves on rather than crashing.
  try {
    if (!(await locator.count().catch(() => 0))) return false;
    if (!(await glideTo(page, locator))) return false;
    await sleep(pre);
    await locator.click({ timeout: 3000 });
    await sleep(post);
    return true;
  } catch { return false; }
}

export async function typeInto(page, locator, text, { perChar = 60 } = {}) {
  try {
    if (!(await locator.count().catch(() => 0))) return false;
    if (!(await glideTo(page, locator))) return false;
    await locator.focus({ timeout: 3000 });
    await sleep(200);
    for (const ch of text) {
      await page.keyboard.insertText(ch);
      await sleep(perChar + Math.random() * 40);
    }
    await sleep(300);
    return true;
  } catch { return false; }
}

export async function goto(page, route, { wait = 'networkidle' } = {}) {
  await page.goto(web() + route, { waitUntil: wait });
  await sleep(500); // let any revealed animations settle
}

export const beat = (ms) => sleep(ms);

/**
 * Freezes the page on a region, then draws a soft spotlight around it.
 * This is "zoom in" at capture time without disturbing the video frame rate.
 */
/**
 * Draw a bright amber ring around an element and hold. Unlike spotlight,
 * this does not dim the rest of the page -- the surroundings stay visible
 * so the eye understands the context. Good for an ad shot: zoom with the
 * ring, then let the ring fade before the clip ends.
 */
export async function highlight(page, locator, { hold = 2200 } = {}) {
  let box;
  try {
    const count = await locator.count();
    if (!count) return;
    box = await locator.boundingBox({ timeout: 3000 });
  } catch { return; }
  if (!box) return;
  await page.addStyleTag({ content: `
    .__ring { position: fixed; pointer-events: none; z-index: 99998;
      border: 3px solid hsl(36 81% 58%); border-radius: 14px;
      box-shadow: 0 0 0 4px hsl(36 81% 58% / 0.25), 0 20px 60px hsl(36 81% 58% / 0.15);
      opacity: 0; transition: opacity 400ms ease-out, transform 400ms ease-out; }
    .__ring.on { opacity: 1; }
  ` });
  await page.evaluate(([b]) => {
    const el = document.createElement('div');
    el.className = '__ring';
    el.style.left = `${b.x - 10}px`;
    el.style.top = `${b.y - 10}px`;
    el.style.width = `${b.width + 20}px`;
    el.style.height = `${b.height + 20}px`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    window.__ring = el;
  }, [box]);
  await sleep(hold);
  await page.evaluate(() => { window.__ring?.classList.remove('on'); });
  await sleep(250);
  await page.evaluate(() => { window.__ring?.remove(); });
}

/**
 * Scroll the target into view, then animate the body to scale up slightly
 * around it. The rest of the page stays readable; this is a soft zoom to
 * guide the eye, not a cropping zoom.
 */
export async function zoomInto(page, locator, { scale = 1.12, hold = 2500 } = {}) {
  let box;
  try { box = await locator.boundingBox({ timeout: 3000 }); } catch { return; }
  if (!box) return;
  await page.evaluate(([b, s]) => {
    document.body.style.transformOrigin = `${b.x + b.width / 2}px ${b.y + b.height / 2}px`;
    document.body.style.transition = 'transform 1200ms cubic-bezier(.2,.8,.2,1)';
    requestAnimationFrame(() => { document.body.style.transform = `scale(${s})`; });
  }, [box, scale]);
  await sleep(hold);
  await page.evaluate(() => {
    document.body.style.transition = 'transform 600ms ease-in';
    document.body.style.transform = 'scale(1)';
  });
  await sleep(700);
}

export async function spotlight(page, locator, hold = 1500) {
  // A missing element on a demo scene is not worth killing the render:
  // if the locator cannot be found quickly, the scene just shows the
  // screen without the spotlight.
  let box;
  try {
    const count = await locator.count();
    if (!count) return;
    box = await locator.boundingBox({ timeout: 3000 });
  } catch { return; }
  if (!box) return;
  await page.addStyleTag({ content: `
    .__spot { position: fixed; inset: 0; pointer-events: none; z-index: 99998;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.45) inset; transition: all 400ms; }
    .__spot::before { content: ''; position: fixed; left: var(--x); top: var(--y); width: var(--w); height: var(--h);
      border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.45); border: 2px solid rgba(255,255,255,0.9); transition: all 400ms; }
  ` });
  await page.evaluate(([b]) => {
    const el = document.createElement('div');
    el.className = '__spot';
    el.style.setProperty('--x', `${b.x - 12}px`);
    el.style.setProperty('--y', `${b.y - 12}px`);
    el.style.setProperty('--w', `${b.width + 24}px`);
    el.style.setProperty('--h', `${b.height + 24}px`);
    document.body.appendChild(el);
    window.__spot = el;
  }, [box]);
  await sleep(hold);
  await page.evaluate(() => { window.__spot?.remove(); });
  await sleep(300);
}
