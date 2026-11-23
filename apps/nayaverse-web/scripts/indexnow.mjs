/**
 * After a deploy, tell the IndexNow search engines which URLs exist.
 *
 * IndexNow (indexnow.org) is shared by Bing, Yandex, Seznam, Naver and
 * others: one submission reaches all of them. Bing's index is what ChatGPT
 * search and Microsoft Copilot answer from, so a page Bing has not seen yet
 * is a page those assistants cannot cite. Without this, a new guide waits for
 * the next crawl, which on a young domain can be weeks.
 *
 * Runs in CI after the deployment is live, never during the build: the
 * engines fetch the key file from the live site to confirm the submission is
 * ours, so the file has to be there first. A failure is reported and never
 * fails the deploy -- a missed ping costs a few days of freshness, not the
 * site.
 *
 * Usage: node scripts/indexnow.mjs   (reads dist/sitemap.xml)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = '2e14114d1ab85230ab47b836f8b89d5e';
const HOST = 'www.nayaversse.in';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sitemap = fs.readFileSync(path.join(app, 'dist', 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) {
  console.log('indexnow: the sitemap lists no URLs; nothing to send');
  process.exit(0);
}

const keyLocation = `https://${HOST}/${KEY}.txt`;
try {
  const live = await fetch(keyLocation, { cache: 'no-store' });
  const body = (await live.text()).trim();
  if (!live.ok || body !== KEY) {
    console.log(`indexnow: ${keyLocation} is not serving the key yet (HTTP ${live.status}); skipping`);
    process.exit(0);
  }
} catch (e) {
  console.log(`indexnow: could not fetch ${keyLocation} (${e.message}); skipping`);
  process.exit(0);
}

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation, urlList: urls }),
  });
  // 200 = received, 202 = received and the key is still being validated.
  const ok = res.status === 200 || res.status === 202;
  console.log(`indexnow: submitted ${urls.length} URLs -> HTTP ${res.status}${ok ? '' : ` ${await res.text()}`}`);
} catch (e) {
  console.log(`indexnow: submission failed (${e.message})`);
}
