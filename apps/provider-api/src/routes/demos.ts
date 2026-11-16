import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import { ONBOARDING_TEMPLATE } from "../lib/onboarding-steps.js";
import { PLAN_LABELS, PLAN_ORDER, resolveFeatures, type PlanTier } from "../lib/plans.js";
import { publicHostFor, portalHostFor } from "../lib/subdomain.js";
import { enqueueDemoReset, jobsAvailable } from "../lib/provision-jobs.js";
import { inlineProvision, shouldProvisionInline } from "../lib/inline-provision.js";

/**
 * Demo clinics: one per plan, to show a prospect.
 *
 * Each is an ordinary clinic deployment with CLINIC_DEMO=1 in its env
 * file: its own database, filled with made-up patients by
 * prisma/seed-demo.ts, reset every morning and on demand. Being ordinary
 * is the point -- a demo that runs different code from a real clinic
 * shows a prospect something they will not get.
 *
 * The logins are the same on every demo and are shown here in the clear,
 * because there is nothing behind them but invented patients. They are
 * never valid on a real clinic: the seed that creates them refuses to run
 * on one.
 */

const DEMO_SLUGS: Record<PlanTier, string> = {
  BASIC: "demo-clinic",
  STANDARD: "demo-polyclinic",
  PREMIUM: "demo-hospital",
  ENTERPRISE: "demo-multispecialty",
};

const DEMO_NAMES: Record<PlanTier, string> = {
  BASIC: "Sai Clinic",
  STANDARD: "Sai Polyclinic",
  PREMIUM: "Sai Hospital",
  ENTERPRISE: "Sai Multispeciality Hospital",
};

/** Who can sign in to each demo, as prisma/seed-demo.ts creates them. */
function demoLogins(plan: PlanTier) {
  const rank = PLAN_ORDER.indexOf(plan);
  const domain = process.env.DEMO_EMAIL_DOMAIN || "demo.nayaverse.in";
  const people = [
    { key: "doctor", who: "Dr. Meera Kulkarni, general medicine (admin)" },
    { key: "reception", who: "Sunita Pawar, reception" },
    { key: "nurse", who: "Rekha Shinde, nurse" },
    ...(rank >= 1 ? [{ key: "doctor2", who: "Dr. Arjun Deshpande, paediatrics" }, { key: "pharmacy", who: "Imran Shaikh, pharmacist" }] : []),
    ...(rank >= 2 ? [
      { key: "gynae", who: "Dr. Anjali Mehta, gynaecology" }, { key: "ortho", who: "Dr. Rohan Joshi, orthopaedics" },
      { key: "cashier", who: "Pooja Kale, cash counter" }, { key: "billing", who: "Mahesh Patil, inpatient billing and claims" },
      { key: "lab", who: "Sameer Khan, laboratory" },
    ] : []),
    ...(rank >= 3 ? [{ key: "radiology", who: "Neha Joshi, radiology" }] : []),
  ];
  return people.map((p) => ({ email: `${p.key}@${domain}`, who: p.who }));
}

export async function demoRoutes(app: FastifyInstance) {
  app.get("/api/provider/demos", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const accounts = await prisma.clinicAccount.findMany({
      where: { isDemo: true },
      select: { id: true, slug: true, name: true, plan: true, status: true, publicDomain: true, portalDomain: true, provisionedAt: true, appliedAt: true, planJobId: true },
    });
    const byPlan = Object.fromEntries(accounts.map((a) => [a.plan, a]));
    return {
      password: process.env.DEMO_PASSWORD || "nayaverse-demo",
      demos: PLAN_ORDER.map((plan) => {
        const a = byPlan[plan] ?? null;
        return {
          plan,
          label: PLAN_LABELS[plan],
          account: a,
          portalUrl: a ? `https://${a.portalDomain || portalHostFor(a.slug, env.PLATFORM_DOMAIN)}` : null,
          siteUrl: a ? `https://${a.publicDomain || publicHostFor(a.slug, env.PLATFORM_DOMAIN)}` : null,
          logins: demoLogins(plan),
        };
      }),
      platformDomain: env.PLATFORM_DOMAIN,
      canReset: jobsAvailable(),
    };
  });

  /**
   * Create an account for each plan that has no demo yet.
   *
   * With inline provisioning on, each demo is also marked live in the
   * same request -- "one click" in the Demos page really is one click,
   * so the user does not have to open each account page afterwards.
   * Otherwise provisioning still happens from the account page, as
   * before, through the host-side runner.
   */
  app.post("/api/provider/demos", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const inline = shouldProvisionInline();
    const existing = await prisma.clinicAccount.findMany({ where: { isDemo: true }, select: { plan: true } });
    const have = new Set(existing.map((e) => e.plan));
    const created: string[] = [];
    const provisioned: string[] = [];
    for (const plan of PLAN_ORDER) {
      if (have.has(plan)) continue;
      const slug = DEMO_SLUGS[plan];
      const taken = await prisma.clinicAccount.findUnique({ where: { slug } });
      if (taken) continue; // a real clinic with that slug is left alone
      const account = await prisma.clinicAccount.create({
        data: {
          slug,
          name: DEMO_NAMES[plan],
          plan,
          isDemo: true,
          notes: "Demonstration clinic: made-up patients, reset every morning. Not a customer.",
          steps: { create: ONBOARDING_TEMPLATE.map((s, i) => ({ key: s.key, label: s.label, automated: s.automated, sortOrder: i })) },
        },
      });
      await prisma.activityLog.create({
        data: { accountId: account.id, actorId: auth.id, actorName: auth.name, action: "demo.created", detail: `${PLAN_LABELS[plan]} demo: ${resolveFeatures(plan, null).join(", ")}` },
      });
      created.push(slug);

      if (inline) {
        try {
          await inlineProvision({
            accountId: account.id,
            slug: account.slug,
            name: account.name,
            plan: account.plan as PlanTier,
            features: resolveFeatures(plan, null),
            actor: { id: auth.id, name: auth.name },
          });
          provisioned.push(slug);
        } catch (e) {
          // Record it and keep going: a fail on demo three should not
          // leave demos one and two half-done. The account is still
          // created; the operator can finish provisioning by hand.
          request.log.error({ err: e, slug }, "inline provision failed for demo");
        }
      }
    }
    return reply.status(created.length ? 201 : 200).send({ created, provisioned });
  });

  app.post("/api/provider/accounts/:id/reset-demo", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const account = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!account) return reply.status(404).send({ error: "Not found" });
    // Checked here and again on the host: the host's check is the one
    // that matters, because it reads the clinic's own env file.
    if (!account.isDemo) return reply.status(400).send({ error: "Only a demo clinic can be reset." });
    if (!jobsAvailable()) return reply.status(503).send({ error: "The job runner is not reachable from this console, so nothing can be reset from here." });
    const jobId = enqueueDemoReset(account.slug);
    await prisma.activityLog.create({ data: { accountId: id, actorId: auth.id, actorName: auth.name, action: "demo.reset", detail: "Queued" } });
    return reply.status(202).send({ jobId });
  });
}
