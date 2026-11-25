#!/usr/bin/env node
/**
 * Screenshots of Nayaversse Growth for its story film (story-growth.json).
 *
 *   node scripts/demo-video/reel/capture-growth.mjs
 *
 * Growth has to be running on this computer in its local test mode
 * (start-dev.ps1 in the nayaverse-growth folder): made-up customers, and
 * nothing is really sent, charged or posted. This signs in as the demo
 * salon and only looks: it opens screens and takes pictures, and never
 * presses anything that saves, approves or sends.
 *
 * Writes out/modules-growth/<name>.png at 1600x1000, twice as sharp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../out/modules-growth');
const WEB = process.env.GROWTH_WEB ?? 'http://localhost:5180';
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(WEB)) {
  console.error(`${WEB} is not this computer. The film is made from the local demo only.`);
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  ', name, '<-', new URL(page.url()).pathname); };

try {
  await page.goto(`${WEB}/signin`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(process.env.GROWTH_EMAIL ?? 'demo@growth.local');
  await page.locator('input[type="password"]').fill(process.env.GROWTH_PASSWORD ?? 'demo-password');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 20_000 });
  await page.waitForLoadState('networkidle');

  for (const [route, name] of [['/', 'overview'], ['/customers', 'customers'], ['/bookings', 'bookings'], ['/campaigns', 'campaigns'],
    ['/campaigns/new', 'new-campaign'], ['/automations', 'automations'], ['/replies', 'replies'], ['/reports', 'reports'], ['/settings', 'settings']]) {
    await page.goto(WEB + route, { waitUntil: 'networkidle' });
    await shot(name);
  }
  // One campaign, opened: where the proof is.
  await page.goto(`${WEB}/campaigns`, { waitUntil: 'networkidle' });
  const first = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
  if (await first.count()) {
    await first.click();
    await page.waitForLoadState('networkidle');
    await shot('campaign');
    await page.mouse.wheel(0, 700);
    await shot('campaign-lower');
  }
  // The first conversation in Replies.
  await page.goto(`${WEB}/replies`, { waitUntil: 'networkidle' });
  const chat = page.locator('a[href^="/replies/"]').first();
  if (await chat.count()) { await chat.click(); await page.waitForLoadState('networkidle'); await shot('reply'); }
} catch (e) {
  console.error('capture failed:', String(e).slice(0, 400));
  await page.screenshot({ path: path.join(OUT, '_failed.png') }).catch(() => {});
} finally {
  await browser.close();
}
