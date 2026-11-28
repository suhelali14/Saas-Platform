import { createPublicKey, type KeyObject } from "node:crypto";
import { env } from "../config/env.js";
import { GST_RATE_PERCENT } from "./billing.js";
import { prisma } from "./prisma.js";
import { resolveFeatures, type PlanTier } from "./plans.js";
import * as rzp from "./razorpay.js";
import { privateKeyFrom, publicKeyFrom, s2sFetch } from "./s2s.js";

/**
 * Subscriptions for every product, sold from this console.
 *
 * A product's customer chooses plans or modules, monthly or yearly, on the
 * product's own screen; the product asks this console (a signed call) to
 * start the subscription; the customer authorises it on Razorpay's page;
 * each paid cycle is recorded here and pushed to the product, which opens
 * what was paid for until the cycle ends (plus a few days' grace while the
 * next one is charged). Prices and the yearly discount are set here.
 */

export type ProductKey = "GROWTH" | "CLINIC";
export type Interval = "MONTH" | "YEAR";

/** What a product opens for an offer. Growth's shape; clinics follow. */
export interface Grants {
  modules?: string[];
  videosMonth?: number;
  aiSecondsMonth?: number;
  /** Growth's posts and photos (its D55): AI photos and published posts a month. */
  photosMonth?: number;
  postsMonth?: number;
  /** Growth's branches: how many shops the plan covers, the main one counted (0 is one). */
  branches?: number;
  /** Growth: the kinds of business the offer is shown to; none is every kind. */
  kinds?: string[];
  /** A clinic plan's tier: BASIC, STANDARD, PREMIUM or ENTERPRISE. */
  plan?: string;
}

/** Growth's modules, as its owners read them (Growth's internal/plans). */
export const GROWTH_MODULES: Record<string, string> = {
  reviews: "Reviews QR",
  whatsapp: "WhatsApp automation",
  ads: "Ads",
  online: "Find customers online",
  content: "Posts and photos",
  dinein: "QR menu and table orders",
};

/** Growth's kinds of business, for an offer made for some of them only. */
export const GROWTH_KINDS: Record<string, string> = {
  restaurant: "Restaurants & cafés",
  hotel: "Hotels & resorts",
  jeweller: "Jewellers",
  clothing: "Clothing stores",
  salon: "Salons",
  spa: "Spas",
  gym: "Gyms",
  coaching: "Coaching classes",
  services: "Other local services",
};

// ── Products this console talks to ─────────────────────────────────────

interface Connection {
  base: string;
  publicKey: KeyObject;
}

let consoleKey: KeyObject | null = null;
export function signingKey(): KeyObject {
  if (!env.CONSOLE_SIGNING_KEY) throw new Error("CONSOLE_SIGNING_KEY is not set on this console.");
  consoleKey ??= privateKeyFrom(env.CONSOLE_SIGNING_KEY);
  return consoleKey;
}

/** This console's public key (base64 SPKI), from its signing key: what
 *  Growth and each clinic set as CONSOLE_PUBLIC_KEY. Public, safe to show;
 *  null if the signing key is not set or not readable. */
export function consolePublicKey(): string | null {
  try {
    return createPublicKey(signingKey()).export({ type: "spki", format: "der" }).toString("base64");
  } catch {
    return null;
  }
}

let growth: Connection | null | undefined;
export function growthConnection(): Connection | null {
  if (growth !== undefined) return growth;
  growth = env.GROWTH_URL && env.GROWTH_PUBLIC_KEY ? { base: env.GROWTH_URL, publicKey: publicKeyFrom(env.GROWTH_PUBLIC_KEY) } : null;
  return growth;
}

/** Who signed a call: Growth (for any of its businesses), or one clinic
 *  (for itself only, so its account is fixed by its key). */
export interface Signer {
  product: ProductKey;
  key: KeyObject;
  account?: { id: string; name: string };
}

export async function whoSigned(keyId: string | undefined): Promise<Signer | null> {
  if (keyId === "growth") {
    const g = growthConnection();
    return g ? { product: "GROWTH", key: g.publicKey } : null;
  }
  const slug = keyId?.startsWith("clinic:") ? keyId.slice(7) : "";
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return null;
  const a = await prisma.clinicAccount.findUnique({ where: { slug }, select: { id: true, name: true, s2sPublicKey: true } });
  if (!a?.s2sPublicKey) return null;
  try {
    return { product: "CLINIC", key: publicKeyFrom(a.s2sPublicKey), account: { id: a.id, name: a.name } };
  } catch {
    return null;
  }
}

/** A clinic server's address: its API domain (health checks use the same). */
export function clinicBase(a: { apiDomain: string | null }): string | null {
  if (!a.apiDomain) return null;
  // A clinic running on the same computer, while developing only.
  if (env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(a.apiDomain)) return `http://${a.apiDomain}`;
  return /^https?:\/\//.test(a.apiDomain) ? a.apiDomain.replace(/\/api\/clinic\/?$/, "") : `https://${a.apiDomain}`;
}

/** A signed call from this console to one clinic's server. */
export function callClinic<T = unknown>(a: { apiDomain: string | null; s2sPublicKey: string | null }, path: string, method = "GET", body?: unknown): Promise<T> {
  const base = clinicBase(a);
  if (!base || !a.s2sPublicKey) throw Object.assign(new Error("This clinic is not connected for signed calls yet: set its API domain and paste its public key."), { status: 409 });
  return s2sFetch<T>({ base, path, method, body, key: signingKey(), keyId: "console" });
}

/** A signed call from this console to Growth. */
export function callGrowth<T = unknown>(path: string, method = "GET", body?: unknown, timeoutMs?: number): Promise<T> {
  const g = growthConnection();
  if (!g) throw Object.assign(new Error("Growth is not connected to this console (GROWTH_URL, GROWTH_PUBLIC_KEY)."), { status: 503 });
  return s2sFetch<T>({ base: g.base, path, method, body, key: signingKey(), keyId: "console", timeoutMs });
}

// ── Prices ─────────────────────────────────────────────────────────────

export async function defaultYearlyDiscount(): Promise<number> {
  const s = await prisma.billingSettings.findUnique({ where: { id: "default" } });
  return s ? Number(s.yearlyDiscountPct) : 0;
}

/** A year at a monthly price less a discount, to the rupee. */
export function yearlyPaise(monthlyPaise: number, discountPct: number): number {
  const pct = Math.min(Math.max(discountPct, 0), 90);
  return Math.round((monthlyPaise * 12 * (100 - pct)) / 100 / 100) * 100;
}

export interface PricedOffer {
  id: string;
  code: string;
  kind: string;
  name: string;
  summary: string;
  includes: string[];
  grants: Grants;
  monthlyPaise: number;
  yearlyPaise: number;
  yearlyDiscountPct: number;
  custom: boolean;
}

/** What a product's customer may buy now: published, priced, and for everyone or made for them. */
export async function onSale(product: ProductKey, accountRef: string): Promise<PricedOffer[]> {
  const pct = await defaultYearlyDiscount();
  const rows = await prisma.catalogOffer.findMany({
    where: { product, published: true, monthlyPricePaise: { not: null }, OR: [{ accountRef: null }, { accountRef }] },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
  return rows
    .map((o) => {
      const d = o.yearlyDiscountPct != null ? Number(o.yearlyDiscountPct) : pct;
      return {
        id: o.id, code: o.code, kind: o.kind, name: o.name, summary: o.summary, includes: o.includes, grants: o.grants as Grants,
        monthlyPaise: o.monthlyPricePaise!, yearlyPaise: yearlyPaise(o.monthlyPricePaise!, d), yearlyDiscountPct: d, custom: o.kind === "custom",
      };
    })
    .sort((a, b) => Number(b.custom) - Number(a.custom));
}

export class SaleError extends Error {
  status = 400;
}

/** Checks a choice of offers and prices it for one cycle. */
export function priceChoice(sale: PricedOffer[], codes: string[], interval: Interval) {
  const chosen: PricedOffer[] = [];
  for (const code of new Set(codes)) {
    const o = sale.find((x) => x.code === code);
    if (!o) throw new SaleError("That plan is not on sale. Reload the page and choose again.");
    chosen.push(o);
  }
  if (chosen.length === 0) throw new SaleError("Choose a plan or at least one module.");
  const plans = chosen.filter((o) => o.kind !== "module");
  if (plans.length > 1) throw new SaleError("Choose one plan. Single modules can go beside it.");
  const plan = plans[0];
  if (plan) {
    for (const o of chosen.filter((x) => x.kind === "module")) {
      if ((o.grants.modules ?? []).every((m) => (plan.grants.modules ?? []).includes(m))) {
        throw new SaleError(`${o.name} is already in ${plan.name}.`);
      }
    }
  }
  const amountPaise = chosen.reduce((a, o) => a + (interval === "MONTH" ? o.monthlyPaise : o.yearlyPaise), 0);
  return { chosen, amountPaise };
}

// ── GST ────────────────────────────────────────────────────────────────

/**
 * Prices are before GST, as the console's terms say of every fee: 18% is
 * added at checkout, to the rupee (billing.ts, GST_RATE_PERCENT). What a
 * subscription charges each cycle is the total.
 */
export function withGst(subtotalPaise: number) {
  const gstPaise = Math.round((subtotalPaise * GST_RATE_PERCENT) / 100 / 100) * 100;
  return { subtotalPaise, gstPercent: GST_RATE_PERCENT, gstPaise, totalPaise: subtotalPaise + gstPaise };
}

/**
 * The subscription being paid for now, which a new one follows. With real
 * payments on, a test one does not count: it never took money, so it must
 * not push a real one months out.
 */
export function runningWhere(product: ProductKey, accountRef: string, mode = env.SUBSCRIPTIONS_MODE) {
  return { product, accountRef, status: "ACTIVE" as const, cancelAtEnd: false, ...(mode === "razorpay" ? { test: false } : {}) };
}

/** What a choice costs each cycle, line by line, before anything is started. */
export async function quoteFor(input: { product: ProductKey; accountRef: string; offers: string[]; interval: Interval }) {
  if (env.SUBSCRIPTIONS_MODE === "off") throw Object.assign(new SaleError("Subscriptions are not switched on in the console."), { status: 409 });
  const sale = await onSale(input.product, input.accountRef);
  const { chosen, amountPaise } = priceChoice(sale, input.offers, input.interval);
  const running = await prisma.subscription.findFirst({ where: runningWhere(input.product, input.accountRef), orderBy: { createdAt: "desc" } });
  return {
    lines: chosen.map((o) => ({ code: o.code, name: o.name, paise: input.interval === "MONTH" ? o.monthlyPaise : o.yearlyPaise })),
    interval: input.interval,
    ...withGst(amountPaise),
    // A switch starts when what is paid now ends.
    startsAt: running?.currentEnd ?? null,
    mode: env.SUBSCRIPTIONS_MODE,
  };
}

// ── Starting one ───────────────────────────────────────────────────────

const OPEN = ["CREATED", "AUTHENTICATED", "ACTIVE", "PENDING"] as const;

async function razorpayPlanFor(interval: Interval, amountPaise: number, name: string): Promise<string> {
  const found = await prisma.razorpayPlan.findUnique({ where: { interval_amountPaise_name: { interval, amountPaise, name } } });
  if (found) return found.id;
  const id = await rzp.createPlan(interval, amountPaise, name);
  await prisma.razorpayPlan.create({ data: { id, interval, amountPaise, name } });
  return id;
}

export async function startSubscription(input: { product: ProductKey; accountRef: string; accountName: string; offers: string[]; interval: Interval; by: string }) {
  if (env.SUBSCRIPTIONS_MODE === "off") throw Object.assign(new SaleError("Subscriptions are not switched on in the console."), { status: 409 });
  const sale = await onSale(input.product, input.accountRef);
  const { chosen, amountPaise: subtotalPaise } = priceChoice(sale, input.offers, input.interval);
  // Each cycle charges the total, GST included.
  const { totalPaise: amountPaise } = withGst(subtotalPaise);
  const productName = input.product === "GROWTH" ? "Nayaversse Growth" : "Nayaverse Clinic";
  const label = `${productName} · ${chosen.map((o) => o.name).join(" + ")} (${input.interval === "MONTH" ? "monthly" : "yearly"})`;

  // A switch: the running one stops at the end of what is paid, and the new one starts there.
  const running = await prisma.subscription.findFirst({ where: runningWhere(input.product, input.accountRef), orderBy: { createdAt: "desc" } });
  const startsAt = running?.currentEnd ?? null;

  // Unpaid ones the customer walked away from are closed, so only one waits.
  await prisma.subscription.updateMany({
    where: { product: input.product, accountRef: input.accountRef, status: "CREATED" },
    data: { status: "EXPIRED" },
  });

  const sub = await prisma.subscription.create({
    data: {
      product: input.product, accountRef: input.accountRef, accountName: input.accountName.slice(0, 120),
      offerCodes: chosen.map((o) => o.code), offerNames: chosen.map((o) => o.name),
      grants: Object.fromEntries(chosen.map((o) => [o.code, { name: o.name, ...o.grants }])),
      interval: input.interval, amountPaise, test: env.SUBSCRIPTIONS_MODE === "test",
      startsAt, replacesId: running?.id ?? null, createdBy: input.by.slice(0, 120),
    },
  });
  if (env.SUBSCRIPTIONS_MODE === "razorpay") {
    try {
      const planId = await razorpayPlanFor(input.interval, amountPaise, label);
      const r = await rzp.createSubscription(planId, input.interval, { product: input.product, account: input.accountRef, subscription: sub.id }, startsAt ?? undefined);
      await prisma.subscription.update({ where: { id: sub.id }, data: { razorpayPlanId: planId, razorpaySubscriptionId: r.id, shortUrl: r.short_url } });
      // The subscription id and the public key id let the product open
      // Razorpay's own checkout on its page; the link is the fallback.
      return { id: sub.id, url: r.short_url, amountPaise, startsAt, razorpaySubscriptionId: r.id, keyId: env.RAZORPAY_KEY_ID ?? null };
    } catch (err) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      throw Object.assign(new Error("Razorpay could not start the subscription just now. Try again in a minute."), { status: 502, cause: err });
    }
  }
  return { id: sub.id, url: null, amountPaise, startsAt, razorpaySubscriptionId: null, keyId: null };
}

// ── A paid cycle ───────────────────────────────────────────────────────

function addInterval(d: Date, interval: Interval): Date {
  const x = new Date(d);
  if (interval === "MONTH") x.setMonth(x.getMonth() + 1);
  else x.setFullYear(x.getFullYear() + 1);
  return x;
}

/**
 * Records one paid cycle and tells the product. paymentId makes it happen
 * once however often Razorpay retries the webhook.
 */
export async function recordCharge(subId: string, c: { paymentId: string | null; amountPaise: number; start: Date; end: Date }) {
  if (c.paymentId) {
    const seen = await prisma.subscriptionCharge.findUnique({ where: { paymentId: c.paymentId } });
    if (seen) return seen;
  }
  const charge = await prisma.$transaction(async (tx) => {
    const ch = await tx.subscriptionCharge.create({
      data: { subscriptionId: subId, paymentId: c.paymentId, amountPaise: c.amountPaise, periodStart: c.start, periodEnd: c.end },
    });
    const sub = await tx.subscription.update({ where: { id: subId }, data: { status: "ACTIVE", currentStart: c.start, currentEnd: c.end } });
    // The one it replaces has done its job.
    if (sub.replacesId) await tx.subscription.updateMany({ where: { id: sub.replacesId, status: { in: [...OPEN] } }, data: { status: "COMPLETED" } });
    // The first real payment ends the account's test ones.
    if (!sub.test) {
      await tx.subscription.updateMany({
        where: { product: sub.product, accountRef: sub.accountRef, test: true, status: { in: [...OPEN] } },
        data: { status: "COMPLETED" },
      });
    }
    return ch;
  });
  await pushCharge(charge.id).catch(() => { pushesWaiting = true; }); // retried by the loop if the product is down
  return charge;
}

/** Tells the product about one paid cycle. Safe to repeat: the product keys on the charge id. */
export async function pushCharge(chargeId: string): Promise<void> {
  const ch = await prisma.subscriptionCharge.findUnique({ where: { id: chargeId }, include: { subscription: true } });
  if (!ch || ch.pushedAt) return;
  const sub = ch.subscription;
  const grace = env.SUBSCRIPTION_GRACE_DAYS * 86_400_000;
  const months = sub.interval === "MONTH" ? 1 : 12;
  const grants = sub.grants as unknown as Record<string, Grants & { name: string }>;
  try {
    if (sub.product === "CLINIC") {
      await pushClinicPlan(sub.accountRef, grants, new Date(ch.periodEnd.getTime() + grace), `${sub.interval === "MONTH" ? "Monthly" : "Yearly"} subscription`);
      await prisma.subscriptionCharge.update({ where: { id: ch.id }, data: { pushedAt: new Date(), pushError: null } });
      return;
    }
    await callGrowth("/api/s2s/v1/grants", "POST", {
      ref: ch.id,
      businessId: sub.accountRef,
      source: "bought",
      amountPaise: ch.amountPaise,
      subscriptionId: sub.id,
      note: `${sub.interval === "MONTH" ? "Monthly" : "Yearly"} subscription`,
      periods: sub.offerCodes.map((code) => ({
        offerCode: code,
        name: grants[code]?.name ?? code,
        modules: grants[code]?.modules ?? [],
        videosMonth: grants[code]?.videosMonth ?? 0,
        photosMonth: grants[code]?.photosMonth ?? 0,
        postsMonth: grants[code]?.postsMonth ?? 0,
        branches: grants[code]?.branches ?? 0,
        aiSeconds: (grants[code]?.aiSecondsMonth ?? 0) * months,
        from: ch.periodStart.toISOString(),
        to: new Date(ch.periodEnd.getTime() + grace).toISOString(),
      })),
    });
    await prisma.subscriptionCharge.update({ where: { id: ch.id }, data: { pushedAt: new Date(), pushError: null } });
  } catch (err) {
    await prisma.subscriptionCharge.update({ where: { id: ch.id }, data: { pushError: (err as Error).message.slice(0, 300) } });
    throw err;
  }
}

/**
 * Sets a clinic's plan on its own server, at once, and records what the
 * clinic now runs. The module list is the plan's, with the clinic's deal
 * overrides, as "Apply plan" has always sent it.
 */
export async function pushClinicPlan(accountId: string, grants: Record<string, Grants & { name: string }>, paidUntil: Date, note: string) {
  const a = await prisma.clinicAccount.findUnique({ where: { id: accountId } });
  if (!a) throw new Error("No such clinic account.");
  const tier = Object.values(grants).map((g) => g.plan).find(Boolean) as PlanTier | undefined;
  if (!tier) throw new Error("This subscription names no clinic plan.");
  const features = resolveFeatures(tier, a.featureOverrides);
  await callClinic(a, "/api/s2s/v1/plan", "PUT", { plan: tier, features, readOnly: false, paidUntil: paidUntil.toISOString(), note });
  await prisma.clinicAccount.update({
    where: { id: a.id },
    data: {
      plan: tier, renewsAt: paidUntil, appliedPlan: tier, appliedFeatures: features.join(","), appliedReadOnly: false, appliedAt: new Date(),
      ...(a.status === "SUSPENDED" ? { status: "LIVE" as const } : {}),
    },
  });
}

/** The stand-in checkout's "pay" (test mode): the first cycle, paid now. */
export async function testPay(subId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!sub || !sub.test) throw Object.assign(new Error("No such test subscription."), { status: 404 });
  if (sub.status !== "CREATED") throw Object.assign(new Error("This payment is already done."), { status: 409 });
  const start = sub.startsAt && sub.startsAt > new Date() ? sub.startsAt : new Date();
  return recordCharge(sub.id, { paymentId: null, amountPaise: sub.amountPaise, start, end: addInterval(start, sub.interval) });
}

/** Test mode, by hand: charges the next cycle now, from where the current one ends. */
export async function renewNow(subId: string) {
  const s = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!s?.test || s.status !== "ACTIVE" || !s.currentEnd) throw Object.assign(new Error("Only an active test subscription can be renewed by hand."), { status: 409 });
  return recordCharge(s.id, { paymentId: null, amountPaise: s.amountPaise, start: s.currentEnd, end: addInterval(s.currentEnd, s.interval) });
}

/** Test mode: renews every test subscription whose cycle has ended, as Razorpay would. */
export async function renewTestSubscriptions(now = new Date()): Promise<number> {
  const due = await prisma.subscription.findMany({ where: { test: true, status: "ACTIVE", cancelAtEnd: false, currentEnd: { lte: now } } });
  for (const s of due) {
    await recordCharge(s.id, { paymentId: null, amountPaise: s.amountPaise, start: s.currentEnd!, end: addInterval(s.currentEnd!, s.interval) });
  }
  // A test subscription cancelled at the end stops there.
  await prisma.subscription.updateMany({ where: { test: true, status: "ACTIVE", cancelAtEnd: true, currentEnd: { lte: now } }, data: { status: "CANCELLED" } });
  return due.length;
}

/**
 * Whether a charge may still be waiting to reach its product. The loop in
 * server.ts reads the database only then (and on a slow sweep), so an idle
 * console lets Neon sleep instead of waking it every minute.
 */
let pushesWaiting = true;
export function pushesMayWait() {
  return pushesWaiting;
}

/** Charges the product has not been told about yet, retried. */
export async function retryPushes(): Promise<number> {
  const waiting = await prisma.subscriptionCharge.findMany({ where: { pushedAt: null }, orderBy: { createdAt: "asc" }, take: 20 });
  let ok = 0;
  for (const c of waiting) {
    try {
      await pushCharge(c.id);
      ok++;
    } catch {
      /* stays waiting; the error is on the row for the console to show */
    }
  }
  pushesWaiting = ok < waiting.length || waiting.length === 20;
  return ok;
}

// ── Stopping one ───────────────────────────────────────────────────────

/** Cancels at the end of what is paid: the customer keeps it until then. */
export async function cancelAtEnd(subId: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!sub) throw Object.assign(new Error("No such subscription."), { status: 404 });
  if (sub.status === "CREATED") {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
    return;
  }
  if (!["ACTIVE", "AUTHENTICATED", "PENDING"].includes(sub.status) || sub.cancelAtEnd) {
    throw Object.assign(new Error("This subscription is already stopping."), { status: 409 });
  }
  if (sub.razorpaySubscriptionId && !sub.test) await rzp.cancelSubscription(sub.razorpaySubscriptionId, true);
  await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtEnd: true } });
}

// ── Razorpay says ──────────────────────────────────────────────────────

const statusFor: Record<string, "AUTHENTICATED" | "ACTIVE" | "PENDING" | "HALTED" | "CANCELLED" | "COMPLETED" | "EXPIRED"> = {
  authenticated: "AUTHENTICATED", active: "ACTIVE", pending: "PENDING", halted: "HALTED", paused: "HALTED",
  cancelled: "CANCELLED", completed: "COMPLETED", expired: "EXPIRED",
};

export async function handleRazorpayEvent(e: rzp.SubscriptionEvent): Promise<"done" | "ignored"> {
  const sub = await prisma.subscription.findUnique({ where: { razorpaySubscriptionId: e.subscriptionId } });
  if (!sub) return "ignored"; // another product's, or not made by this console
  if (e.event === "subscription.charged" && e.paymentId && e.currentStart && e.currentEnd) {
    await recordCharge(sub.id, { paymentId: e.paymentId, amountPaise: e.paymentAmount ?? sub.amountPaise, start: e.currentStart, end: e.currentEnd });
    return "done";
  }
  const status = statusFor[e.status];
  if (status) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status, ...(e.currentEnd ? { currentEnd: e.currentEnd } : {}), ...(e.currentStart ? { currentStart: e.currentStart } : {}) },
    });
  }
  return "done";
}

/** What a product's screen shows about one subscription. */
export function view(s: { id: string; offerNames: string[]; offerCodes: string[]; interval: string; amountPaise: number; status: string; currentStart: Date | null; currentEnd: Date | null; cancelAtEnd: boolean; startsAt: Date | null; shortUrl: string | null; test: boolean; createdAt: Date }) {
  return {
    id: s.id, names: s.offerNames, codes: s.offerCodes, interval: s.interval, amountPaise: s.amountPaise, status: s.status,
    currentStart: s.currentStart, currentEnd: s.currentEnd, cancelAtEnd: s.cancelAtEnd, startsAt: s.startsAt,
    url: s.status === "CREATED" ? s.shortUrl : null, test: s.test, createdAt: s.createdAt,
  };
}
