// The console's published prices as of the last build that reached it.
// Written by scripts/fetch-pricing.mjs before every build; edit prices in
// the console, never here. fetchedAt null: no build has reached the console
// yet, so the site shows the founder's figures in site.ts.
import type { PublicPricing } from './pricing';

export const snapshot: PublicPricing = {
  fetchedAt: null,
  updatedAt: null,
  defaultYearlyDiscountPct: 0,
  products: { GROWTH: [], CLINIC: [], BUSINESS: [] },
};
