import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireProviderAuth, requireOwnerAuth } from "../plugins/auth.js";
import { ONBOARDING_TEMPLATE } from "../lib/onboarding-steps.js";
import { FEATURES, SUGGESTED_MONTHLY_FEE, resolveFeatures, type PlanTier } from "../lib/plans.js";
// provisionClinic is gone with the route that used it; the remaining
// two report whether provisioning is configured.
import { provisioningAvailable, isDryRun } from "../lib/provisioning.js";
import { validateSlug } from "../lib/subdomain.js";
import { env } from "../config/env.js";
import { queueHealth } from "../lib/provision-jobs.js";

const PLANS = ["BASIC", "STANDARD", "PREMIUM"] as const;
const STATUSES = ["LEAD", "ONBOARDING", "LIVE", "SUSPENDED", "CHURNED"] as const;

/** Domains are typed by hand from a sales call, so they arrive with
 * schemes, trailing slashes and stray spaces. Normalised once here rather
 * than defensively everywhere downstream. */
const domain = z
  .string()
  .trim()
  .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase())
  .refine((v) => v === "" || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), "That does not look like a domain name")
  .optional();

const accountSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only").optional(),
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().max(200).optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional(),
  city: z.string().max(120).optional(),
  notes: z.string().max(4000).optional(),
  status: z.enum(STATUSES).optional(),
  plan: z.enum(PLANS).optional(),
  featureOverrides: z.record(z.boolean()).optional(),
  monthlyFee: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  currency: z.string().max(8).optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional(),
  startedAt: z.string().optional().nullable(),
  renewsAt: z.string().optional().nullable(),
  publicDomain: domain,
  portalDomain: domain,
  apiDomain: domain,
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "clinic";
}

async function log(accountId: string | null, actor: { id: string; name: string }, action: string, detail?: string, applied = true) {
  await prisma.activityLog.create({
    data: { accountId, actorId: actor.id, actorName: actor.name, action, detail: detail ?? null, applied },
  });
}

export async function accountRoutes(app: FastifyInstance) {
  /** Reference data the console needs to render its forms. */
  app.get("/api/provider/meta", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    return {
      plans: PLANS,
      statuses: STATUSES,
      features: FEATURES,
      suggestedFees: SUGGESTED_MONTHLY_FEE,
      onboardingTemplate: ONBOARDING_TEMPLATE,
      provisioning: { ...provisioningAvailable(), dryRun: isDryRun() },
      // So the console can show a clinic's real hostnames instead of a
      // placeholder. Not a secret, and this route is authenticated.
      platformDomain: env.PLATFORM_DOMAIN,
      // So the console can say why provisioning is unavailable before
      // the operator clicks, rather than after a Neon project exists.
      queue: queueHealth(),
    };
  });

  app.get("/api/provider/accounts", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;

    const accounts = await prisma.clinicAccount.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        steps: { select: { done: true } },
        health: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
    });

    return {
      accounts: accounts.map((a) => {
        const { steps, health, ...rest } = a;
        return {
          ...rest,
          progress: { done: steps.filter((s) => s.done).length, total: steps.length },
          lastHealth: health[0] ?? null,
        };
      }),
      // Revenue is only counted for accounts actually being served. A LEAD
      // is a hope, not income, and a SUSPENDED account is not paying.
      mrr: accounts
        .filter((a) => a.status === "LIVE")
        .reduce((sum, a) => sum + Number(a.monthlyFee ?? 0), 0),
    };
  });

  app.get("/api/provider/accounts/:id", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const account = await prisma.clinicAccount.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { sortOrder: "asc" } },
        activity: { orderBy: { at: "desc" }, take: 50 },
        health: { orderBy: { checkedAt: "desc" }, take: 20 },
      },
    });
    if (!account) return reply.status(404).send({ error: "Not found" });

    return {
      account,
      features: resolveFeatures(account.plan as PlanTier, account.featureOverrides),
    };
  });

  app.post("/api/provider/accounts", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;

    const parsed = accountSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { slug, contactEmail, startedAt, renewsAt, monthlyFee, featureOverrides, ...rest } = parsed.data;
    const finalSlug = slug ?? slugify(parsed.data.name);

    // A slug is a hostname here, not just a key: it becomes
    // <slug>.<platform domain>. So it has to clear the DNS-label rules and
    // the reserved list before it can clash-check, or a clinic called
    // "api" would claim the platform's own hostname.
    const slugCheck = validateSlug(finalSlug);
    if (!slugCheck.ok) {
      return reply.status(400).send({ error: slugCheck.reason, field: "slug" });
    }

    const clash = await prisma.clinicAccount.findUnique({ where: { slug: finalSlug } });
    if (clash) return reply.status(400).send({ error: `The identifier "${finalSlug}" is already used by ${clash.name}.` });

    const account = await prisma.clinicAccount.create({
      data: {
        ...rest,
        slug: finalSlug,
        contactEmail: contactEmail === "" ? null : contactEmail,
        monthlyFee: monthlyFee ?? null,
        startedAt: startedAt ? new Date(startedAt) : null,
        renewsAt: renewsAt ? new Date(renewsAt) : null,
        featureOverrides: featureOverrides ?? undefined,
        // The checklist is created up front so progress is visible from the
        // first minute rather than appearing as work happens.
        steps: {
          create: ONBOARDING_TEMPLATE.map((s, i) => ({
            key: s.key,
            label: s.label,
            automated: s.automated,
            sortOrder: i,
          })),
        },
      },
    });

    await log(account.id, auth, "account.created", `${account.name} (${account.plan})`);
    return reply.status(201).send(account);
  });

  app.put("/api/provider/accounts/:id", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = accountSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const { contactEmail, startedAt, renewsAt, monthlyFee, featureOverrides, ...rest } = parsed.data;
    const account = await prisma.clinicAccount.update({
      where: { id },
      data: {
        ...rest,
        ...(contactEmail !== undefined ? { contactEmail: contactEmail === "" ? null : contactEmail } : {}),
        ...(monthlyFee !== undefined ? { monthlyFee } : {}),
        ...(startedAt !== undefined ? { startedAt: startedAt ? new Date(startedAt) : null } : {}),
        ...(renewsAt !== undefined ? { renewsAt: renewsAt ? new Date(renewsAt) : null } : {}),
        ...(featureOverrides !== undefined ? { featureOverrides } : {}),
      },
    });

    // A plan change is the one edit worth calling out on its own: it
    // changes what the clinic's deployment will register at next boot.
    const changes: string[] = [];
    if (parsed.data.plan && parsed.data.plan !== existing.plan) changes.push(`plan ${existing.plan} → ${parsed.data.plan}`);
    if (parsed.data.status && parsed.data.status !== existing.status) changes.push(`status ${existing.status} → ${parsed.data.status}`);
    await log(id, auth, "account.updated", changes.join(", ") || undefined);

    return account;
  });

  app.patch("/api/provider/accounts/:id/steps/:key", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;

    const { id, key } = request.params as { id: string; key: string };
    const parsed = z.object({ done: z.boolean(), notes: z.string().max(1000).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const step = await prisma.onboardingStep.update({
      where: { accountId_key: { accountId: id, key } },
      data: { done: parsed.data.done, doneAt: parsed.data.done ? new Date() : null, notes: parsed.data.notes },
    });
    await log(id, auth, parsed.data.done ? "step.completed" : "step.reopened", step.label);
    return step;
  });

  /**
   * Provision the clinic's infrastructure.
   *
   * Owner-only: it creates billable resources and writes DNS. Runs as a dry
   * run whenever credentials are absent, and records which it was.
   */
  /**
   * Superseded by POST /accounts/:id/provision-clinic.
   *
   * This created Vercel projects for the clinic's API and web, which is
   * no longer how anything is deployed: clinic APIs are containers on
   * our own server, because Vercel's filesystem would lose patient
   * scans, and clinic-web is a single deployment serving every clinic
   * through the wildcard.
   *
   * Refused rather than deleted, so anything still calling it is told
   * where to go instead of silently creating billable Vercel projects
   * that nothing will ever serve.
   */
  app.post("/api/provider/accounts/:id/provision", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    return reply.status(410).send({
      error:
        "Superseded. Use POST /api/provider/accounts/:id/provision-clinic, which creates the database and queues the server work.",
    });
  });

  app.delete("/api/provider/accounts/:id", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const account = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!account) return reply.status(404).send({ error: "Not found" });

    // Removing the account here does not remove the clinic's database or
    // deployments — those hold a real clinic's patient records and are
    // never deleted by this console. Said plainly in the response so nobody
    // assumes a tidy console means tidy infrastructure.
    await prisma.clinicAccount.delete({ where: { id } });
    await log(null, auth, "account.deleted", account.name);
    return {
      ok: true,
      warning: account.neonProjectId
        ? "Removed from the console only. The clinic's database and deployments still exist and must be decommissioned deliberately."
        : undefined,
    };
  });
}
