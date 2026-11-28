import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { defaultYearlyDiscount, yearlyPaise, type Grants } from "../lib/subscriptions.js";

/**
 * Every published price, for nayaversse.in. Public on
 * purpose: these are the prices the site prints, so there is nothing to
 * sign and no secret to hold. Only what is on sale, priced, and for
 * everyone: never a plan made for one customer.
 *
 * The site reads this when it is built (so the page a search engine sees
 * has the console's prices) and again in the browser (so a price changed
 * here shows within minutes).
 *
 * Every visitor's browser asks, so the answer is kept in memory for five
 * minutes rather than read from the database each time. Saving a price in
 * the console clears it at once (pricingChanged).
 */

const KEEP_MS = 5 * 60_000;
let kept: { at: number; body: unknown } | null = null;

/** A price, a plan or the yearly discount changed: answer afresh. */
export function pricingChanged(): void {
  kept = null;
}

async function publicPricing() {
  const pct = await defaultYearlyDiscount();
  const rows = await prisma.catalogOffer.findMany({
    where: { published: true, monthlyPricePaise: { not: null }, accountRef: null, kind: { not: "custom" } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  const products: Record<string, unknown[]> = { GROWTH: [], CLINIC: [], BUSINESS: [] };
  let updatedAt = new Date(0);
  for (const o of rows) {
    const d = o.yearlyDiscountPct != null ? Number(o.yearlyDiscountPct) : pct;
    const g = o.grants as Grants;
    products[o.product]?.push({
      code: o.code, kind: o.kind, name: o.name, summary: o.summary, includes: o.includes,
      modules: g.modules ?? [], videosMonth: g.videosMonth ?? 0, aiSecondsMonth: g.aiSecondsMonth ?? 0, plan: g.plan ?? null,
      monthlyPaise: o.monthlyPricePaise!, yearlyPaise: yearlyPaise(o.monthlyPricePaise!, d), yearlyDiscountPct: d,
    });
    if (o.updatedAt > updatedAt) updatedAt = o.updatedAt;
  }
  return { updatedAt, defaultYearlyDiscountPct: pct, products };
}

export async function publicPricingRoutes(app: FastifyInstance) {
  app.get("/api/provider/public/pricing", async (_request, reply) => {
    if (!kept || Date.now() - kept.at > KEEP_MS) kept = { at: Date.now(), body: await publicPricing() };
    // Readable from any page: the prices are public, the request carries no
    // credentials, and nothing else on this API opens to the site.
    reply.header("Access-Control-Allow-Origin", "*");
    reply.removeHeader("Access-Control-Allow-Credentials");
    reply.header("Cache-Control", "public, max-age=300");
    return kept.body;
  });
}
