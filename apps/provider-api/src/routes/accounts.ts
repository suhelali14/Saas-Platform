import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireProviderAuth, requireOwnerAuth } from "../plugins/auth.js";
import { ONBOARDING_TEMPLATE } from "../lib/onboarding-steps.js";
import { FEATURES, SUGGESTED_MONTHLY_FEE, resolveFeatures, type PlanTier } from "../lib/plans.js";
// provisionClinic is gone with the route that used it; the remaining
// two report whether provisioning is configured.
import { provisioningAvailable, isDryRun } from "../lib/provisioning.js";
import { validateSlug, publicHostFor, portalHostFor } from "../lib/subdomain.js";
import { env } from "../config/env.js";
import { queueHealth, enqueueDomainSync } from "../lib/provision-jobs.js";

const PLANS = ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as const;
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

/**
 * Which record a custom domain needs, and where.
 *
 * The apex of a zone cannot hold a CNAME -- it has to coexist with that
 * zone's SOA and NS records, and RFC 1034 does not allow a CNAME
 * alongside anything else. Registrars either refuse it or accept it and
 * quietly break the domain's mail. So the apex gets an A record and a
 * subdomain gets a CNAME.
 *
 * Apex is decided by counting labels, with the second-level registry
 * suffixes India actually uses spelled out: drasif.in is an apex with two
 * labels and drasif.co.in is an apex with three. A full public-suffix
 * list would be more correct, but it is a dependency that needs updating
 * and the failure here is recoverable -- the record is shown to a person,
 * who can see whether their domain has a subdomain on the front.
 */
const REGISTRY_SUFFIXES = new Set([
  "co", "net", "org", "gen", "firm", "ind", "ac", "edu", "gov", "mil", "res",
]);

function isApex(host: string): boolean {
  const labels = host.split(".");
  if (labels.length <= 2) return true;
  // drasif.co.in -- three labels, but still the apex of its zone.
  return labels.length === 3 && REGISTRY_SUFFIXES.has(labels[1]!);
}

function dnsRecordFor(host: string) {
  const apex = isApex(host);
  return {
    type: apex ? "A" : "CNAME",
    name: host,
    // Vercel's apex address and its CNAME target. The website is a static
    // bundle on Vercel; only the clinic's API lives on the VPS.
    value: apex ? "76.76.21.21" : "cname.vercel-dns.com",
    note: apex
      ? `At the registrar for ${host}, as an A record on the root (often written "@"). A CNAME is not valid at a domain's apex. Then add ${host} to the clinic-web project, or it will serve the wrong site.`
      : `At the registrar for ${host}. Then add ${host} to the clinic-web project, or it will serve the wrong site.`,
  };
}

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

    const {
      contactEmail, startedAt, renewsAt, monthlyFee, featureOverrides,
      // Deliberately dropped here. Changing a website address has to
      // check uniqueness and then tell the clinic's API about itself,
      // which is what PUT /accounts/:id/domains does. Accepting them
      // silently on the general edit route would be a second path to the
      // same change with none of the safety -- and the clinic would end
      // up refusing its own website.
      //
      // apiDomain is NOT dropped: it is where the clinic's server answers,
      // not a website the browser is served from, so no clinic has to be
      // told when it changes.
      slug: _slug, publicDomain: _publicDomain, portalDomain: _portalDomain,
      ...rest
    } = parsed.data;
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

  /**
   * Change where a clinic's website lives.
   *
   * Three things can move, and they are not equally safe:
   *
   * - The **slug** changes the platform addresses
   *   (vadgaonkar.nayaverse.in -> drmomin.nayaverse.in). Both are covered
   *   by the existing wildcard certificate and need no DNS work, and the
   *   clinic's API hostname is stored separately and deliberately left
   *   alone -- so this does NOT require re-provisioning. The old address
   *   stops working immediately, which is the part worth warning about.
   * - A **custom domain** is additive: the clinic keeps its platform
   *   address and gains its own. It needs DNS from the clinic's registrar
   *   and the domain attached to the website project, neither of which
   *   this console can do, so both are returned as instructions.
   * - Either change makes the clinic's API refuse the new address, because
   *   CORS is an allowlist written when the clinic was provisioned. That is
   *   the part that cannot be left to a later manual step: the site would
   *   load and then fail every request. So a job is queued to the host.
   */
  app.put("/api/provider/accounts/:id/domains", async (request, reply) => {
    // Owner-only. These are the addresses patients have been given and
    // the addresses the clinic's own API trusts.
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        slug: z.string().trim().toLowerCase().min(2).max(63).optional(),
        publicDomain: domain,
        portalDomain: domain,
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const account = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!account) return reply.status(404).send({ error: "Not found" });

    const slug = parsed.data.slug ?? account.slug;
    const publicDomain = parsed.data.publicDomain === undefined ? account.publicDomain : (parsed.data.publicDomain || null);
    const portalDomain = parsed.data.portalDomain === undefined ? account.portalDomain : (parsed.data.portalDomain || null);

    if (slug !== account.slug) {
      // The same rules the slug was created under -- reserved names, DNS
      // label length, no leading hyphen. A slug is a hostname here, so a
      // value that merely passes the regex is not necessarily usable.
      const problem = validateSlug(slug);
      if (!problem.ok) return reply.status(400).send({ error: problem.reason });

      const clash = await prisma.clinicAccount.findUnique({ where: { slug }, select: { id: true, name: true } });
      if (clash && clash.id !== id) {
        return reply.status(409).send({ error: `"${slug}" is already used by ${clash.name}.` });
      }
    }

    // A custom domain is how the directory finds a clinic, and that lookup
    // matches on the first row it finds. Two accounts claiming one
    // hostname would resolve to whichever was created first, silently and
    // differently depending on the query plan -- so it is refused here.
    if (publicDomain && publicDomain === portalDomain) {
      return reply.status(400).send({
        error: "The patient site and the staff portal cannot share one hostname -- the bundle would not know which to render.",
      });
    }

    for (const value of [publicDomain, portalDomain]) {
      if (!value) continue;
      const taken = await prisma.clinicAccount.findFirst({
        where: { id: { not: id }, OR: [{ publicDomain: value }, { portalDomain: value }] },
        select: { name: true },
      });
      if (taken) {
        return reply.status(409).send({
          error: `${value} is already pointed at ${taken.name}. Remove it there first.`,
        });
      }
    }

    // Every address this clinic's website may be served from. Both the
    // platform subdomains and any custom domain: a clinic that has its own
    // domain keeps the platform one working, which is what makes a custom
    // domain safe to set up before DNS has propagated.
    const origins = [
      `https://${publicHostFor(slug, env.PLATFORM_DOMAIN)}`,
      `https://${portalHostFor(slug, env.PLATFORM_DOMAIN)}`,
      ...(publicDomain ? [`https://${publicDomain}`] : []),
      ...(portalDomain ? [`https://${portalDomain}`] : []),
    ];

    const updated = await prisma.clinicAccount.update({
      where: { id },
      data: { slug, publicDomain, portalDomain },
    });

    const changes: string[] = [];
    if (slug !== account.slug) changes.push(`slug ${account.slug} → ${slug}`);
    if (publicDomain !== account.publicDomain) changes.push(`public ${account.publicDomain ?? "none"} → ${publicDomain ?? "none"}`);
    if (portalDomain !== account.portalDomain) changes.push(`portal ${account.portalDomain ?? "none"} → ${portalDomain ?? "none"}`);
    await log(id, auth, "account.domains-changed", changes.join(", ") || "no change");

    // Only a provisioned clinic has an env file to rewrite and a container
    // to restart. For one that has not been provisioned yet, the addresses
    // are simply recorded and add-clinic.sh will derive the right list.
    let jobId: string | null = null;
    let queueProblem: string | null = null;
    if (account.provisionedAt) {
      const health = queueHealth();
      if (!health.ok) {
        queueProblem = health.reason;
      } else {
        try {
          jobId = enqueueDomainSync({ slug, origins });
        } catch (error) {
          queueProblem = error instanceof Error ? error.message : "Could not queue the origin update.";
        }
      }
    }

    return {
      account: updated,
      origins,
      jobId,
      // Stated rather than implied. Without the origin update the new
      // address serves the site and then fails every request it makes,
      // and that is not a failure anyone would attribute to a domain
      // change they made in a console.
      pending: queueProblem
        ? `The addresses are saved, but this clinic's API has NOT been told about them yet: ${queueProblem} Until that is done, ${publicDomain ?? publicHostFor(slug, env.PLATFORM_DOMAIN)} will load and then fail every request with a CORS error.`
        : null,
      // What this console cannot do itself, so nobody is left assuming it
      // did. DNS belongs to the clinic's registrar, and the website
      // project's domain list belongs to the host.
      dns: [publicDomain, portalDomain]
        .filter((h): h is string => Boolean(h))
        .map((host) => dnsRecordFor(host)),
    };
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
