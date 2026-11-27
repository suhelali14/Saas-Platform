import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { currentPlan, enabledModules, isReadOnly, maxUsers, moduleStates, planOverride } from "../config/features.js";
import { prisma } from "../lib/prisma.js";
import { callConsole, consoleConnected, consoleKeys, savePlanState } from "../lib/plan-state.js";
import { verifyRequest } from "../lib/s2s.js";
import { requireAdminAuth } from "../plugins/auth.js";

/**
 * This clinic's plan, sold by the Nayaversse console as a monthly or yearly
 * subscription (Growth's D54 for the scheme; docs/CONSOLE.md).
 *
 * The console reads this clinic's status and sets its plan over signed
 * calls (/api/s2s/v1/*); the plan is in force at once. The clinic's admin
 * sees the plan, subscribes and stops renewing from Settings, Plan; those
 * calls go on to the console, signed by this clinic, which can only ever
 * subscribe for itself.
 *
 * Nothing here reads or sends any patient data.
 */

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

function fail(reply: FastifyReply, err: unknown) {
  const e = err as Error & { status?: number };
  const status = e.status && e.status < 500 ? e.status : 502;
  return reply.status(status).send({ error: status === 502 && !e.status ? "The Nayaversse console did not answer. Try again in a minute." : e.message });
}

async function status() {
  const [clinic, users] = await Promise.all([
    prisma.clinic.findFirst({ select: { name: true } }),
    prisma.clinicUser.count({ where: { isActive: true } }),
  ]);
  const o = planOverride();
  const plan = currentPlan();
  return {
    ref: env.CONSOLE_CLINIC_REF ?? null,
    clinic: clinic?.name ?? null,
    plan: plan.tier,
    label: plan.label,
    modules: [...enabledModules()],
    readOnly: isReadOnly(),
    paidUntil: o?.paidUntil ?? null,
    source: o ? "console" : "env",
    users,
    maxUsers: maxUsers(),
  };
}

const planBody = z.object({
  plan: z.string(),
  features: z.array(z.string()).nullable().optional(),
  readOnly: z.boolean().optional(),
  paidUntil: z.string().nullable().optional(),
  note: z.string().max(200).optional(),
});

/** What the console calls, signed with its key. */
async function fromConsole(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    request.rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const k = consoleKeys();
    const ok =
      k &&
      request.headers["x-nv-key"] === "console" &&
      verifyRequest(k.console, request.method, request.url, request.rawBody ?? "", request.headers["x-nv-time"] as string | undefined, request.headers["x-nv-signature"] as string | undefined);
    if (!ok) return reply.status(k ? 401 : 404).send({ error: k ? "Bad signature." : "Not found." });
  });

  app.get("/api/s2s/v1/status", async () => status());

  app.put("/api/s2s/v1/plan", { config: { assistant: false } }, async (request, reply) => {
    const body = planBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "A plan is needed." });
    try {
      const o = await savePlanState(body.data);
      request.log.info({ plan: o.plan, readOnly: o.readOnly, paidUntil: o.paidUntil }, "plan set by the console");
      return status();
    } catch (err) {
      return fail(reply, err);
    }
  });
}

/** The clinic's admin, in Settings, Plan. */
async function forAdmins(app: FastifyInstance) {
  app.get("/api/clinic/plan", async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    const base = { ...(await status()), modules: moduleStates(), connected: consoleConnected(), offers: [] as unknown[], subscriptions: [] as unknown[], mode: "" };
    if (!consoleConnected()) return base;
    try {
      const [cat, subs] = await Promise.all([
        callConsole<{ offers: unknown[]; mode: string }>("/api/provider/s2s/v1/catalog"),
        callConsole<{ subscriptions: unknown[] }>("/api/provider/s2s/v1/subscriptions"),
      ]);
      return { ...base, offers: cat.offers, mode: cat.mode, subscriptions: subs.subscriptions };
    } catch (err) {
      request.log.warn({ err }, "console");
      return { ...base, unreachable: true };
    }
  });

  app.post("/api/clinic/plan/subscribe", { config: { assistant: false } }, async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    const body = z.object({ offer: z.string().min(1).max(80), interval: z.enum(["month", "year"]) }).safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "Choose a plan, and monthly or yearly." });
    const clinic = await prisma.clinic.findFirst({ select: { name: true } });
    try {
      const r = await callConsole<{ id: string; url: string | null; amountPaise: number }>("/api/provider/s2s/v1/subscriptions", "POST", {
        accountRef: env.CONSOLE_CLINIC_REF, accountName: clinic?.name ?? "Clinic", offers: [body.data.offer],
        interval: body.data.interval === "month" ? "MONTH" : "YEAR", by: request.clinicUserName ?? "",
      });
      return { id: r.id, url: r.url ?? `/settings?tab=plan&checkout=${encodeURIComponent(r.id)}`, amountPaise: r.amountPaise };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get("/api/clinic/plan/subscriptions/:id", async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    try {
      return await callConsole(`/api/provider/s2s/v1/subscriptions/${encodeURIComponent((request.params as { id: string }).id)}`);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/clinic/plan/subscriptions/:id/pay", { config: { assistant: false } }, async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    try {
      return await callConsole(`/api/provider/s2s/v1/subscriptions/${encodeURIComponent((request.params as { id: string }).id)}/test-pay`, "POST", {});
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/clinic/plan/subscriptions/:id/cancel", { config: { assistant: false } }, async (request, reply) => {
    if (!requireAdminAuth(request, reply)) return;
    try {
      return await callConsole(`/api/provider/s2s/v1/subscriptions/${encodeURIComponent((request.params as { id: string }).id)}/cancel`, "POST", {});
    } catch (err) {
      return fail(reply, err);
    }
  });
}

export async function clinicPlanRoutes(app: FastifyInstance) {
  app.register(fromConsole);
  app.register(forAdmins);
}
