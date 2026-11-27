#!/usr/bin/env node
/**
 * Screenshot every module of the real clinic portal for the story video.
 *
 *   node scripts/demo-video/reel/capture-modules.mjs [id,id,...]
 *       -> scripts/demo-video/out/modules/<id>.png  (2200x2500, DPR 2)
 *
 * Reads the deployed demo (demo-multispecialty has every module switched
 * on). Navigation only: it opens screens and tabs, and never saves,
 * dispenses, bills or edits anything.
 *
 * The viewport is 1100x1250, close to the 880x1000 window the video frames
 * it in, so a screenshot fills the frame at 0.8x and the camera can zoom
 * into one region without the text going soft (DPR 2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// FORMAT=reel -> 1100x1250 (fills the vertical card); FORMAT=yt -> 1600x1000 (16:10 desktop)
const FORMAT = process.env.FORMAT || 'reel';
const VIEW = FORMAT === 'yt' ? { width: 1600, height: 1000 } : { width: 1100, height: 1250 };
const OUT = path.resolve(HERE, `../out/modules-${FORMAT}`);
const DEMO = process.env.DEMO || 'demo-multispecialty';
// The portal moved to nayaversse.in but its build still calls the API on the
// old nayaverse.in host, whose CORS allow-list does not include the new
// origin, so a normal browser lands on /login. Until that is redeployed the
// capture browser runs with web security off (read-only screenshots of our
// own demo) and takes its token from the host the portal actually calls.
const WEB = `https://${DEMO}.portal.nayaversse.in`;
const API = `https://${DEMO}.api.nayaverse.in/api/clinic`;
const PASSWORD = 'nayaverse-demo';
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;

const ENC = '/appointments/cmwoy7jyp004yp201l3ej9f3j/encounter'; // Ramesh Joshi, in consultation
const SHOTS = [
  { id: 'overview', route: '/' },
  { id: 'queue', route: '/queue' },
  { id: 'requests', route: '/requests' },
  { id: 'patients', route: '/patients' },
  { id: 'patient', route: '/patients/cmwj6vekp000mmq0v4c23ep40' }, // Fatima Sayyed, antenatal
  { id: 'encounter', route: ENC },
  { id: 'rx', route: ENC, steps: [{ text: 'Prescription' }, { fill: { placeholder: 'Drug name', value: 'amlo' }, wait: 2400 }] },
  { id: 'labs', route: '/labs' },
  { id: 'radiology', route: '/radiology', as: 'radiology', settle: 5000 },
  { id: 'pharmacy', route: '/pharmacy', steps: [{ text: 'Inventory' }] },
  { id: 'billing', route: '/billing', as: 'billing' },
  { id: 'closing', route: '/billing', as: 'billing', steps: [{ text: 'Daily Closing', wait: 5000 }] },
  { id: 'claims', route: '/claims', as: 'billing' },
  { id: 'ipd', route: '/ipd' },
  { id: 'nursing', route: '/nursing', as: 'nurse' },
  { id: 'reminders', route: '/reminders', steps: [{ text: 'Overdue to return' }] },
  { id: 'expenses', route: '/expenses' },
  { id: 'analytics', route: '/analytics' },
  { id: 'website', route: '/website' },
  { id: 'livequeue', route: '/live-queue' },
  { id: 'site', url: 'https://demo-multispecialty.nayaversse.in/' },
  { id: 'site-mr', url: 'https://demo-multispecialty.nayaversse.in/?lang=mr' },
  { id: 'staff', route: '/staff' },
  { id: 'audit', route: '/audit' },
  { id: 'settings', route: '/settings', steps: [{ text: 'Documents' }] },
  { id: 'backup', route: '/settings', steps: [{ text: 'Data & Backup' }] },
].filter(s => !only || only.has(s.id));

const ACCOUNTS = { doctor: 'doctor@demo.nayaverse.in', radiology: 'radiology@demo.nayaverse.in', billing: 'billing@demo.nayaverse.in', nurse: 'nurse@demo.nayaverse.in' };
const tokens = {};
async function token(who) {
  if (tokens[who]) return tokens[who];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ACCOUNTS[who], password: PASSWORD }) });
    if (r.ok) return (tokens[who] = (await r.json()).token);
    if (r.status === 429) { await new Promise(res => setTimeout(res, 66_000)); continue; }
    throw new Error(`login ${who}: ${r.status} ${await r.text()}`);
  }
  throw new Error(`login ${who} failed`);
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--hide-scrollbars', '--disable-web-security'] });
const report = [];
for (const s of SHOTS) {
  const who = s.as || 'doctor';
  const tk = await token(who);
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await context.addInitScript(t => { try { localStorage.setItem('clinicAccessToken', t); localStorage.setItem('clinicTheme', 'light'); } catch {} }, tk);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  try {
    await page.goto(s.url ?? WEB + s.route, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(s.settle ?? 1500);
    if (s.clickFirst) {
      await page.locator(s.clickFirst).filter({ hasNotText: /^$/ }).nth(0).click();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
    }
    if (s.clickButton) {
      await page.getByRole('button', { name: s.clickButton }).or(page.getByRole('link', { name: s.clickButton })).first().click();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(1800);
    }
    if (s.thenClick) {
      await page.getByRole('button', { name: s.thenClick }).or(page.getByRole('tab', { name: s.thenClick })).first().click();
      await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
    }
    for (const st of s.steps ?? []) {
      if (st.text) await page.getByText(st.text, { exact: true }).first().click();
      if (st.fill) { const loc = page.getByPlaceholder(st.fill.placeholder).first(); await loc.click(); await loc.pressSequentially(st.fill.value, { delay: 140 }); }
      if (st.hover) await page.getByText(st.hover, { exact: false }).first().hover();
      await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(st.wait ?? 1600);
    }
    // The demo-only banner ("data resets each night") and the setup nudge
    // are not the product a clinic sees once it is set up; hide both.
    await page.evaluate(() => {
      for (const needle of ['data resets each night', 'missing 1 essential detail']) {
        const leaf = [...document.querySelectorAll('body *')].reverse().find(e => e.textContent.includes(needle));
        if (!leaf) continue;
        // climb to the first ancestor that is drawn as a box (its own
        // background or border): that is the banner, never the page column
        let el = leaf;
        const boxed = e => { const cs = getComputedStyle(e); return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0; };
        while (el.parentElement && el.parentElement !== document.body && !boxed(el)) el = el.parentElement;
        if (el.textContent.length < 600) el.style.display = 'none';
      }
    });
    // no toasts or focus rings in a still
    await page.evaluate(() => { document.activeElement?.blur?.(); document.querySelectorAll('[role="status"][aria-live]').forEach(n => { if (n.textContent.trim()) n.style.display = 'none'; }); });
    const file = path.join(OUT, `${s.id}.png`);
    await page.screenshot({ path: file });
    report.push(`${s.id.padEnd(10)} ok   ${page.url().replace(WEB, '')}${errs.length ? '  pageerror: ' + errs[0] : ''}`);
  } catch (e) {
    report.push(`${s.id.padEnd(10)} FAIL ${String(e.message).split('\n')[0]}`);
  }
  await context.close();
}
await browser.close();
console.log(report.join('\n'));
