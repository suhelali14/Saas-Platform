/**
 * Before a build: the console's published prices into
 * src/content/pricing-snapshot.ts, so the HTML the prerender writes (what a
 * search engine reads) carries them. See src/content/pricing.ts.
 *
 * It never fails the build. If the console cannot be reached, or answers
 * with something that is not a price list, the snapshot already in the
 * repository stays, and the browser asks again when the page opens.
 *
 * PRICING_URL overrides the address (a local console, for instance).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'src', 'content', 'pricing-snapshot.ts');
const url = process.env.PRICING_URL?.trim() || 'https://api.nayaverse.in/api/provider/public/pricing';

/** The same checks as readPricing in src/content/pricing.ts. */
function read(d, fetchedAt) {
  if (!d || typeof d !== 'object') return null;
  const p = d.products;
  if (!p || typeof p !== 'object') return null;
  const list = (v) => {
    if (!Array.isArray(v)) return null;
    const rows = [];
    for (const r of v) {
      if (!r || typeof r !== 'object') return null;
      if (typeof r.code !== 'string' || typeof r.name !== 'string') return null;
      if (r.kind !== 'plan' && r.kind !== 'module') continue;
      if (!Number.isInteger(r.monthlyPaise) || r.monthlyPaise <= 0) return null;
      rows.push({
        code: r.code,
        kind: r.kind,
        name: r.name,
        summary: typeof r.summary === 'string' && r.summary.trim() ? r.summary : null,
        includes: Array.isArray(r.includes) ? r.includes.filter((s) => typeof s === 'string' && s.trim() !== '') : [],
        plan: typeof r.plan === 'string' ? r.plan : null,
        monthlyPaise: r.monthlyPaise,
        yearlyPaise: Number.isInteger(r.yearlyPaise) ? r.yearlyPaise : r.monthlyPaise * 12,
        yearlyDiscountPct: typeof r.yearlyDiscountPct === 'number' ? r.yearlyDiscountPct : 0,
      });
    }
    return rows;
  };
  const GROWTH = list(p.GROWTH ?? []);
  const CLINIC = list(p.CLINIC ?? []);
  const BUSINESS = list(p.BUSINESS ?? []);
  if (!GROWTH || !CLINIC || !BUSINESS) return null;
  return {
    fetchedAt,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : null,
    defaultYearlyDiscountPct: typeof d.defaultYearlyDiscountPct === 'number' ? d.defaultYearlyDiscountPct : 0,
    products: { GROWTH, CLINIC, BUSINESS },
  };
}

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  const p = read(await res.json(), new Date().toISOString());
  if (!p) throw new Error('the answer is not a price list');
  const text = `// The console's published prices as of the last build that reached it.
// Written by scripts/fetch-pricing.mjs before every build; edit prices in
// the console, never here. fetchedAt null: no build has reached the console
// yet, so the site shows the founder's figures in site.ts.
import type { PublicPricing } from './pricing';

export const snapshot: PublicPricing = ${JSON.stringify(p, null, 2)};
`;
  fs.writeFileSync(out, text);
  const n = (k) => p.products[k].length;
  console.log(`pricing: from the console, ${n('GROWTH')} Growth, ${n('CLINIC')} clinic, ${n('BUSINESS')} fare chart`);
} catch (err) {
  console.warn(`pricing: kept the last snapshot (${err instanceof Error ? err.message : err})`);
}
