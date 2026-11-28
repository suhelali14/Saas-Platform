/**
 * The prices the site prints, from the console (console.nayaverse.in),
 * which is where the founder sets them.
 *
 * Two copies, so the page is right for a search engine and for a person:
 *  - pricing-snapshot.ts, written when the site is built, so the HTML that
 *    is served already carries the console's prices;
 *  - a fetch from the browser once the page is up, so a price changed in
 *    the console shows within minutes, without a rebuild.
 * If the console cannot be reached, the last known prices stay.
 *
 * What each part of the site reads:
 *  - the fare chart's rows A-C: the console's BUSINESS offers a-c. A row
 *    taken off sale reads "on enquiry", like row D.
 *  - each clinic class: the console's clinic plan for that tier, once it is
 *    on sale; until then, the founder's figure in site.ts.
 *  - Growth: "from" the cheapest Growth plan on sale, and the list of plans
 *    and single modules on sale; until the console answers, site.ts.
 */
import { useSyncExternalStore } from 'react';
import { snapshot } from './pricing-snapshot';
import { prices } from './site';
import { healthClasses } from './structure';

export interface PublicOffer {
  code: string;
  kind: 'plan' | 'module';
  name: string;
  summary: string | null;
  includes: string[];
  plan: string | null;
  monthlyPaise: number;
  yearlyPaise: number;
  yearlyDiscountPct: number;
}

export interface PublicPricing {
  /** When a build last reached the console; null if none has. */
  fetchedAt: string | null;
  updatedAt: string | null;
  defaultYearlyDiscountPct: number;
  products: { GROWTH: PublicOffer[]; CLINIC: PublicOffer[]; BUSINESS: PublicOffer[] };
}

export interface SitePrices {
  /** Rupees a month for each clinic class, in healthClasses order. */
  clinicClasses: number[];
  growthFrom: number;
  growthPlans: PublicOffer[];
  growthModules: PublicOffer[];
  /** Rupees a month for fare rows A-C; null for a row taken off sale. */
  fares: (number | null)[];
  fareLow: number;
  fareHigh: number;
}

export const PRICING_URL =
  (import.meta.env.VITE_PRICING_URL as string | undefined)?.trim() || 'https://api.nayaverse.in/api/provider/public/pricing';

const fareCodes = ['a', 'b', 'c'];

/** The console's answer, checked; null if it is not one. Kept in step with
 *  scripts/fetch-pricing.mjs, which checks the same before a build. */
export function readPricing(d: unknown, fetchedAt: string): PublicPricing | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const p = o.products as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object') return null;
  const list = (v: unknown): PublicOffer[] | null => {
    if (!Array.isArray(v)) return null;
    const out: PublicOffer[] = [];
    for (const x of v) {
      if (!x || typeof x !== 'object') return null;
      const r = x as Record<string, unknown>;
      if (typeof r.code !== 'string' || typeof r.name !== 'string') return null;
      if (r.kind !== 'plan' && r.kind !== 'module') continue;
      if (!Number.isInteger(r.monthlyPaise) || (r.monthlyPaise as number) <= 0) return null;
      out.push({
        code: r.code,
        kind: r.kind,
        name: r.name,
        summary: typeof r.summary === 'string' && r.summary.trim() ? r.summary : null,
        includes: Array.isArray(r.includes) ? r.includes.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [],
        plan: typeof r.plan === 'string' ? r.plan : null,
        monthlyPaise: r.monthlyPaise as number,
        yearlyPaise: Number.isInteger(r.yearlyPaise) ? (r.yearlyPaise as number) : (r.monthlyPaise as number) * 12,
        yearlyDiscountPct: typeof r.yearlyDiscountPct === 'number' ? r.yearlyDiscountPct : 0,
      });
    }
    return out;
  };
  const GROWTH = list(p.GROWTH ?? []);
  const CLINIC = list(p.CLINIC ?? []);
  const BUSINESS = list(p.BUSINESS ?? []);
  if (!GROWTH || !CLINIC || !BUSINESS) return null;
  return {
    fetchedAt,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
    defaultYearlyDiscountPct: typeof o.defaultYearlyDiscountPct === 'number' ? o.defaultYearlyDiscountPct : 0,
    products: { GROWTH, CLINIC, BUSINESS },
  };
}

const rs = (paise: number) => Math.round(paise / 100);

const derived = new WeakMap<PublicPricing, SitePrices>();

export function sitePrices(p: PublicPricing): SitePrices {
  const hit = derived.get(p);
  if (hit) return hit;
  const known = p.fetchedAt !== null;
  const clinic = p.products.CLINIC.filter((o) => o.kind === 'plan');
  const growthPlans = p.products.GROWTH.filter((o) => o.kind === 'plan');
  const growthModules = p.products.GROWTH.filter((o) => o.kind === 'module');
  const business = p.products.BUSINESS;
  const fares = known
    ? fareCodes.map((c) => {
        const o = business.find((b) => b.code === c);
        return o ? rs(o.monthlyPaise) : null;
      })
    : [...prices.fares];
  const onSale = fares.filter((n): n is number => n !== null);
  const out: SitePrices = {
    clinicClasses: healthClasses.map((h, i) => {
      const o = clinic.find((c) => c.plan === h.plan);
      return o ? rs(o.monthlyPaise) : prices.clinicClasses[i];
    }),
    growthFrom: growthPlans.length ? Math.min(...growthPlans.map((o) => rs(o.monthlyPaise))) : prices.growthFrom,
    growthPlans,
    growthModules,
    fares,
    fareLow: onSale.length ? Math.min(...onSale) : prices.fares[0],
    fareHigh: onSale.length ? Math.max(...onSale) : prices.fares[prices.fares.length - 1],
  };
  derived.set(p, out);
  return out;
}

/* The browser's copy: one fetch per page load, shared by every component. */

let current: PublicPricing = snapshot;
const listeners = new Set<() => void>();
let asked = false;

function ask() {
  if (asked || typeof window === 'undefined' || typeof fetch !== 'function') return;
  asked = true;
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(8000) : undefined;
  fetch(PRICING_URL, { signal, credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const p = readPricing(d, new Date().toISOString());
      if (!p) return;
      current = p;
      listeners.forEach((f) => f());
    })
    .catch(() => {
      /* the last known prices stay */
    });
}

function subscribe(f: () => void) {
  listeners.add(f);
  ask();
  return () => {
    listeners.delete(f);
  };
}

/** The prices to print. The first paint (and the prerendered HTML) uses the
 *  build's snapshot; the console's live answer replaces it when it comes. */
export function usePrices(): SitePrices {
  const p = useSyncExternalStore(
    subscribe,
    () => current,
    () => snapshot,
  );
  return sitePrices(p);
}

/** For the prerender (page titles, search markup): the build's snapshot. */
export function buildPrices(): SitePrices {
  return sitePrices(snapshot);
}
