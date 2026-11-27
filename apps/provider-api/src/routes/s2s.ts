import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { parseEvent, validWebhook } from "../lib/razorpay.js";
import { verifyRequest } from "../lib/s2s.js";
import { cancelAtEnd, handleRazorpayEvent, onSale, SaleError, startSubscription, testPay, view, whoSigned, type Signer } from "../lib/subscriptions.js";

/**
 * What products call (signed, src/lib/s2s.ts) and what Razorpay calls. Both
 * need the body exactly as sent, so this plugin reads JSON as text and
 * parses it itself.
 */

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

/** Who signed the request, or a 401. */
async function signedBy(request: FastifyRequest, reply: FastifyReply): Promise<Signer | null> {
  const who = await whoSigned(request.headers["x-nv-key"] as string | undefined);
  const ok =
    who &&
    verifyRequest(who.key, request.method, request.url, request.rawBody ?? "", request.headers["x-nv-time"] as string | undefined, request.headers["x-nv-signature"] as string | undefined);
  if (!who || !ok) {
    reply.status(401).send({ error: "Bad signature." });
    return null;
  }
  return who;
}

/** The account a call is about: a clinic only ever its own; Growth says which business. */
const accountOf = (who: Signer, asked: string) => who.account?.id ?? asked;

function fail(reply: FastifyReply, err: unknown) {
  const e = err as Error & { status?: number };
  const status = err instanceof SaleError ? err.status : e.status ?? 500;
  if (status >= 500) reply.log.error({ err }, "s2s");
  return reply.status(status).send({ error: status >= 500 && !e.status ? "Something went wrong." : e.message });
}

const subscribeBody = z.object({
  accountRef: z.string().trim().min(1).max(120),
  accountName: z.string().trim().min(1).max(120),
  offers: z.array(z.string().max(80)).min(1).max(10),
  interval: z.enum(["MONTH", "YEAR"]),
  by: z.string().trim().max(120).default(""),
});

export async function s2sRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    request.rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  app.addHook("onRequest", async (request) => {
    request.rawBody ??= "";
  });

  // ── For products ─────────────────────────────────────────────────────
  app.get("/api/provider/s2s/v1/catalog", async (request, reply) => {
    const who = await signedBy(request, reply);
    if (!who) return;
    const { account = "" } = request.query as { account?: string };
    try {
      return { offers: await onSale(who.product, accountOf(who, account)), mode: env.SUBSCRIPTIONS_MODE };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/provider/s2s/v1/subscriptions", async (request, reply) => {
    const who = await signedBy(request, reply);
    if (!who) return;
    const body = subscribeBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Choose a plan, and monthly or yearly." });
    try {
      return await startSubscription({
        product: who.product, ...body.data, accountRef: accountOf(who, body.data.accountRef), accountName: who.account?.name ?? body.data.accountName,
        by: body.data.by || body.data.accountName,
      });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get("/api/provider/s2s/v1/subscriptions", async (request, reply) => {
    const who = await signedBy(request, reply);
    if (!who) return;
    const { account = "" } = request.query as { account?: string };
    const subs = await prisma.subscription.findMany({
      where: { product: who.product, accountRef: accountOf(who, account), status: { not: "EXPIRED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return { subscriptions: subs.map(view) };
  });

  // One subscription, only for the account it belongs to.
  const own = async (request: FastifyRequest, reply: FastifyReply) => {
    const who = await signedBy(request, reply);
    if (!who) return null;
    const { id } = request.params as { id: string };
    const { account = "" } = request.query as { account?: string };
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub || sub.product !== who.product || sub.accountRef !== accountOf(who, account)) {
      reply.status(404).send({ error: "No such subscription." });
      return null;
    }
    return sub;
  };

  app.get("/api/provider/s2s/v1/subscriptions/:id", async (request, reply) => {
    const sub = await own(request, reply);
    if (!sub) return;
    return { subscription: view(sub) };
  });

  app.post("/api/provider/s2s/v1/subscriptions/:id/cancel", async (request, reply) => {
    const sub = await own(request, reply);
    if (!sub) return;
    try {
      await cancelAtEnd(sub.id);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/provider/s2s/v1/subscriptions/:id/test-pay", async (request, reply) => {
    const sub = await own(request, reply);
    if (!sub) return;
    try {
      await testPay(sub.id);
      return { ok: true };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // ── Razorpay ─────────────────────────────────────────────────────────
  app.post("/api/provider/webhooks/razorpay", async (request, reply) => {
    const body = request.rawBody ?? "";
    if (!validWebhook(body, request.headers["x-razorpay-signature"] as string | undefined)) {
      return reply.status(403).send({ error: "Bad signature." });
    }
    const e = parseEvent(body);
    if (!e) return { ignored: true };
    try {
      return { result: await handleRazorpayEvent(e) };
    } catch (err) {
      request.log.error({ err, event: e.event }, "razorpay webhook");
      return reply.status(500).send({ error: "Try again." }); // Razorpay retries
    }
  });
}
