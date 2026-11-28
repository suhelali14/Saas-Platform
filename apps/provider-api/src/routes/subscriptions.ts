import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import { publicKeyFrom } from "../lib/s2s.js";
import { pricingChanged } from "./public-pricing.js";
import {
  GROWTH_MODULES, callClinic, callGrowth, cancelAtEnd, consolePublicKey, defaultYearlyDiscount, growthConnection, renewNow, retryPushes, yearlyPaise, type Grants,
} from "../lib/subscriptions.js";

/**
 * The console's screens for subscriptions: the yearly discount, each
 * product's catalogue and prices, every subscription, and (for Growth) its
 * businesses, welcome links, plans given by hand and "make me a plan"
 * requests, read from and sent to Growth over signed calls.
 */

function fail(reply: FastifyReply, err: unknown) {
  const e = err as Error & { status?: number };
  const status = e.status && e.status < 600 ? e.status : 502;
  return reply.status(status).send({ error: e.message || "Growth did not answer." });
}

const offerBody = z.object({
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().max(160).default(""),
  includes: z.array(z.string().trim().min(1).max(140)).max(8).default([]),
  modules: z.array(z.string()).default([]),
  videosMonth: z.coerce.number().int().min(0).max(200).default(0),
  aiSecondsMonth: z.coerce.number().int().min(0).max(3600).default(0),
  photosMonth: z.coerce.number().int().min(0).max(1000).default(0),
  postsMonth: z.coerce.number().int().min(0).max(300).default(0),
  branches: z.coerce.number().int().min(0).max(50).default(0),
  priceRupees: z.coerce.number().int().min(1).max(10_00_000).nullable().default(null),
  yearlyDiscountPct: z.coerce.number().min(0).max(90).nullable().default(null),
  published: z.boolean().default(false),
});

export async function subscriptionRoutes(app: FastifyInstance) {
  // ── Settings ─────────────────────────────────────────────────────────
  app.get("/api/provider/billing-settings", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const s = await prisma.billingSettings.findUnique({ where: { id: "default" } });
    return {
      yearlyDiscountPct: s ? Number(s.yearlyDiscountPct) : 0,
      updatedBy: s?.updatedBy ?? null,
      updatedAt: s?.updatedAt ?? null,
      mode: env.SUBSCRIPTIONS_MODE,
      growthConnected: Boolean(growthConnection()),
    };
  });

  app.put("/api/provider/billing-settings", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const body = z.object({ yearlyDiscountPct: z.coerce.number().min(0).max(90) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "The yearly discount is a percentage from 0 to 90." });
    await prisma.billingSettings.upsert({
      where: { id: "default" },
      create: { id: "default", yearlyDiscountPct: body.data.yearlyDiscountPct, updatedBy: auth.name },
      update: { yearlyDiscountPct: body.data.yearlyDiscountPct, updatedBy: auth.name },
    });
    pricingChanged();
    return { ok: true };
  });

  // ── Catalogue ────────────────────────────────────────────────────────
  app.get("/api/provider/catalog", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const { product = "GROWTH" } = request.query as { product?: string };
    if (product !== "GROWTH" && product !== "CLINIC" && product !== "BUSINESS") return reply.status(400).send({ error: "Unknown product." });
    const pct = await defaultYearlyDiscount();
    const rows = await prisma.catalogOffer.findMany({ where: { product }, orderBy: [{ kind: "asc" }, { position: "asc" }, { name: "asc" }] });
    return {
      defaultYearlyDiscountPct: pct,
      modules: product === "GROWTH" ? GROWTH_MODULES : {},
      offers: rows.map((o) => {
        const d = o.yearlyDiscountPct != null ? Number(o.yearlyDiscountPct) : pct;
        return {
          ...o,
          yearlyDiscountPct: o.yearlyDiscountPct != null ? Number(o.yearlyDiscountPct) : null,
          effectiveYearlyDiscountPct: d,
          yearlyPricePaise: o.monthlyPricePaise ? yearlyPaise(o.monthlyPricePaise, d) : null,
        };
      }),
    };
  });

  const cleanGrants = (product: string, b: z.infer<typeof offerBody>, current?: Grants): Grants | string => {
    // A clinic plan opens its tier; that is fixed by the offer, not edited.
    if (product === "CLINIC") return { plan: current?.plan };
    // The site's fare chart only prices; nothing is opened by it yet.
    if (product === "BUSINESS") return {};
    if (product === "GROWTH") {
      const bad = b.modules.find((m) => !GROWTH_MODULES[m]);
      if (bad) return `Unknown module: ${bad}.`;
      if (b.modules.length === 0 && b.videosMonth === 0) return "Choose at least one module, or some videos a month.";
      if (b.modules.includes("content") && b.photosMonth === 0 && b.postsMonth === 0) return "Posts and photos needs some photos or posts a month.";
    }
    return { modules: [...new Set(b.modules)], videosMonth: b.videosMonth, aiSecondsMonth: b.aiSecondsMonth, photosMonth: b.photosMonth, postsMonth: b.postsMonth, branches: b.branches };
  };

  app.put("/api/provider/catalog/:id", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const found = await prisma.catalogOffer.findUnique({ where: { id } });
    if (!found) return reply.status(404).send({ error: "Not found." });
    const body = offerBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Check the fields." });
    if (body.data.published && body.data.priceRupees == null) return reply.status(400).send({ error: "Set a price before putting it on sale." });
    const grants = cleanGrants(found.product, body.data, found.grants as Grants);
    if (typeof grants === "string") return reply.status(400).send({ error: grants });
    await prisma.catalogOffer.update({
      where: { id },
      data: {
        name: body.data.name, summary: body.data.summary, includes: body.data.includes, grants: grants as object,
        monthlyPricePaise: body.data.priceRupees == null ? null : body.data.priceRupees * 100,
        yearlyDiscountPct: body.data.yearlyDiscountPct, published: body.data.published, updatedBy: auth.name,
      },
    });
    pricingChanged();
    return { ok: true };
  });

  // A plan made for one customer of a product, on sale to them alone.
  app.post("/api/provider/catalog/custom", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const body = offerBody.extend({ product: z.enum(["GROWTH", "CLINIC"]), accountRef: z.string().min(1).max(120), accountName: z.string().min(1).max(120) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Check the fields." });
    if (body.data.priceRupees == null) return reply.status(400).send({ error: "Set the monthly price." });
    const grants = cleanGrants(body.data.product, body.data);
    if (typeof grants === "string") return reply.status(400).send({ error: grants });
    const code = `custom-${randomBytes(4).toString("hex")}`;
    await prisma.catalogOffer.create({
      data: {
        id: `${body.data.product.toLowerCase()}:${code}`, product: body.data.product, code, kind: "custom",
        name: body.data.name, summary: body.data.summary, includes: body.data.includes, grants: grants as object,
        monthlyPricePaise: body.data.priceRupees * 100, yearlyDiscountPct: body.data.yearlyDiscountPct, published: true,
        accountRef: body.data.accountRef, accountName: body.data.accountName, updatedBy: auth.name,
      },
    });
    return { code };
  });

  // ── Subscriptions ────────────────────────────────────────────────────
  app.get("/api/provider/subscriptions", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const { product } = request.query as { product?: string };
    const subs = await prisma.subscription.findMany({
      where: { ...(product === "GROWTH" || product === "CLINIC" ? { product } : {}), status: { not: "EXPIRED" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { charges: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const active = subs.filter((s) => s.status === "ACTIVE");
    const monthly = active.reduce((a, s) => a + (s.interval === "MONTH" ? s.amountPaise : Math.round(s.amountPaise / 12)), 0);
    return {
      mode: env.SUBSCRIPTIONS_MODE,
      monthlyRecurringPaise: monthly,
      subscriptions: subs.map((s) => ({
        id: s.id, product: s.product, accountRef: s.accountRef, accountName: s.accountName, names: s.offerNames, interval: s.interval,
        amountPaise: s.amountPaise, status: s.status, currentEnd: s.currentEnd, cancelAtEnd: s.cancelAtEnd, startsAt: s.startsAt, test: s.test,
        createdBy: s.createdBy, createdAt: s.createdAt,
        lastCharge: s.charges[0] ? { at: s.charges[0].createdAt, pushedAt: s.charges[0].pushedAt, pushError: s.charges[0].pushError } : null,
      })),
    };
  });

  app.post("/api/provider/subscriptions/:id/cancel", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    try {
      await cancelAtEnd((request.params as { id: string }).id);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Test mode: charge the next cycle now, as Razorpay will when this one ends.
  app.post("/api/provider/subscriptions/:id/test-renew", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    try {
      await renewNow((request.params as { id: string }).id);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Test mode: the next renewal fails and Razorpay gives up, as with a bounced mandate.
  app.post("/api/provider/subscriptions/:id/test-fail", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    const sub = await prisma.subscription.findUnique({ where: { id: (request.params as { id: string }).id } });
    if (!sub?.test || sub.status !== "ACTIVE") return reply.status(409).send({ error: "Only an active test subscription can be failed by hand." });
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "HALTED" } });
    return { ok: true };
  });

  app.post("/api/provider/subscriptions/retry-pushes", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    return { pushed: await retryPushes() };
  });

  // ── Clinics, through their own servers ───────────────────────────────
  // The clinic server's public key (its private half stays in its env).
  app.put("/api/provider/accounts/:id/s2s-key", async (request, reply) => {
    if (!requireOwnerAuth(request, reply)) return;
    const body = z.object({ publicKey: z.string().trim().max(200).nullable() }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Paste the clinic's public key." });
    if (body.data.publicKey) {
      try {
        publicKeyFrom(body.data.publicKey);
      } catch {
        return reply.status(400).send({ error: "That is not an Ed25519 public key. Paste the PUBLIC_KEY line from s2s-keygen." });
      }
    }
    await prisma.clinicAccount.update({ where: { id: (request.params as { id: string }).id }, data: { s2sPublicKey: body.data.publicKey || null } });
    return { ok: true };
  });

  // What the clinic's own server says it runs now.
  app.get("/api/provider/accounts/:id/s2s-status", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const a = await prisma.clinicAccount.findUnique({ where: { id: (request.params as { id: string }).id } });
    if (!a) return reply.status(404).send({ error: "Not found." });
    try {
      return await callClinic(a, "/api/s2s/v1/status");
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Growth, through its own server ───────────────────────────────────

  // Whether Growth and this console really accept each other, not only
  // whether the addresses are set. Both directions:
  //  - this console calls Growth (Growth's CONSOLE_PUBLIC_KEY must be this
  //    console's public key, returned here);
  //  - Growth, asked to, calls this console back (this console's
  //    GROWTH_PUBLIC_KEY must be Growth's public key, which Growth returns),
  //    which is what Growth's Plans page needs to list the plans.
  app.get("/api/provider/growth/check", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const consoleKey = consolePublicKey();
    const configured = Boolean(growthConnection());
    const none = { fromGrowth: null };
    if (!configured) return { configured, ok: false, consolePublicKey: consoleKey, error: "GROWTH_URL and GROWTH_PUBLIC_KEY are not set on this console.", ...none };
    if (!consoleKey) return { configured, ok: false, consolePublicKey: null, error: "CONSOLE_SIGNING_KEY is not set on this console, or is not a private key.", ...none };
    try {
      await callGrowth("/api/s2s/v1/requests");
    } catch (err) {
      return { configured, ok: false, consolePublicKey: consoleKey, error: (err as Error).message || "Growth did not answer.", ...none };
    }
    // The other way. A Growth without this check yet answers 404: unknown.
    let fromGrowth: { ok: boolean; error: string; consoleUrl: string; growthPublicKey: string } | null = null;
    try {
      fromGrowth = await callGrowth("/api/s2s/v1/console-check");
    } catch {
      fromGrowth = null;
    }
    return { configured, ok: true, consolePublicKey: consoleKey, error: null, fromGrowth };
  });

  app.get("/api/provider/growth/businesses", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    const { q = "" } = request.query as { q?: string };
    try {
      return await callGrowth(`/api/s2s/v1/businesses?q=${encodeURIComponent(q.slice(0, 80))}`);
    } catch (err) {
      return fail(reply, err);
    }
  });

  // A plan given by hand: a free month, or a payment taken another way.
  app.post("/api/provider/growth/businesses/:id/grant", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const body = z.object({ offerCode: z.string().min(1), months: z.coerce.number().int().min(1).max(24), note: z.string().trim().min(1).max(200) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Choose the plan, 1 to 24 months, and say why." });
    const offer = await prisma.catalogOffer.findUnique({ where: { product_code: { product: "GROWTH", code: body.data.offerCode } } });
    if (!offer) return reply.status(400).send({ error: "Choose a plan or module." });
    const g = offer.grants as Grants;
    try {
      return await callGrowth("/api/s2s/v1/grants", "POST", {
        ref: `desk-${randomBytes(8).toString("hex")}`,
        businessId: (request.params as { id: string }).id,
        source: "desk",
        amountPaise: 0,
        note: `${body.data.note} · ${auth.name}`,
        periods: [{
          offerCode: offer.code, name: offer.name, modules: g.modules ?? [], videosMonth: g.videosMonth ?? 0, photosMonth: g.photosMonth ?? 0, postsMonth: g.postsMonth ?? 0, branches: g.branches ?? 0,
          aiSeconds: (g.aiSecondsMonth ?? 0) * body.data.months, months: body.data.months,
        }],
      });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get("/api/provider/growth/welcome", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    try {
      return await callGrowth("/api/s2s/v1/welcome");
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/provider/growth/welcome", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    try {
      return await callGrowth("/api/s2s/v1/welcome", "POST", { ...(request.body as object), by: auth.name });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get("/api/provider/growth/requests", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    try {
      return await callGrowth("/api/s2s/v1/requests");
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/provider/growth/requests/:id/done", async (request, reply) => {
    if (!requireProviderAuth(request, reply)) return;
    try {
      return await callGrowth(`/api/s2s/v1/requests/${encodeURIComponent((request.params as { id: string }).id)}/done`, "POST", {});
    } catch (err) {
      return fail(reply, err);
    }
  });
}
