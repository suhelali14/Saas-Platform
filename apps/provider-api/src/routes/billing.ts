import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { requireOwnerAuth, requireProviderAuth } from "../plugins/auth.js";
import {
  invoiceLines, invoiceNumber, invoiceTotals, financialYear, nextPeriodStart, STATE_CODES, stateFromGstin,
  type Contract,
} from "../lib/billing.js";
import { PLAN_LABELS, PLAN_MAX_USERS, resolveFeatures, runningFeatures, type PlanTier } from "../lib/plans.js";
import { enqueuePlanSync, jobsAvailable } from "../lib/provision-jobs.js";

/**
 * Plans reaching clinics, and Nayaverse's own invoices.
 *
 * ── Applying a plan ──────────────────────────────────────────────────
 *
 * Editing an account's plan in the console changes a row here and
 * nothing else. "Apply to clinic" is the step that changes what the
 * clinic can do: it records who changed what and why (PlanChange), then
 * queues a job that rewrites the clinic's env file and restarts it. The
 * console shows what the clinic is actually running next to what has been
 * chosen, so an unapplied edit is visible rather than assumed.
 *
 * Without a job runner (local development, or a console not on the
 * clinic's server) the change is recorded and the exact env lines are
 * returned for someone to apply by hand -- never silently dropped.
 *
 * ── Invoices ─────────────────────────────────────────────────────────
 *
 * A draft can be changed or deleted. Issuing gives it the next number in
 * the financial year and freezes it: from then on it can only be marked
 * paid or voided, because a tax invoice that changes after it was sent is
 * not an invoice. Numbers are allocated under an advisory lock, so two
 * operators issuing at once cannot both take the same serial.
 */

function contractOf(a: {
  pricingModel: string; billingCycle: string; setupFee: unknown; yearlyFee: unknown; monthlyFee: unknown;
  licenceFee: unknown; amcPercent: unknown; hostingFee: unknown;
}): Contract {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    pricingModel: a.pricingModel as Contract["pricingModel"],
    billingCycle: a.billingCycle as Contract["billingCycle"],
    setupFee: n(a.setupFee), yearlyFee: n(a.yearlyFee), monthlyFee: n(a.monthlyFee),
    licenceFee: n(a.licenceFee), amcPercent: n(a.amcPercent), hostingFee: n(a.hostingFee),
  };
}

/** What a contract brings in per month, for the console's revenue line. */
export function monthlyValue(c: Contract): number {
  if (c.pricingModel === "SUBSCRIPTION") return c.monthlyFee ?? 0;
  if (c.pricingModel === "SETUP_YEARLY") return (c.yearlyFee ?? 0) / 12;
  const amc = c.licenceFee && c.amcPercent ? (c.licenceFee * c.amcPercent) / 100 : 0;
  return (amc + (c.hostingFee ?? 0)) / 12;
}

/** The env lines a plan becomes on the clinic's server. */
function envLines(slug: string, plan: PlanTier, features: string[], readOnly: boolean, maxUsers: number | null): string {
  return [
    `# /srv/clinic/env/${slug}.env`,
    `CLINIC_PLAN=${plan}`,
    `CLINIC_FEATURES=${features.join(",")}`,
    `CLINIC_READ_ONLY=${readOnly ? "1" : "0"}`,
    maxUsers === null ? "# CLINIC_MAX_USERS unset: the plan's own cap applies" : `CLINIC_MAX_USERS=${maxUsers}`,
  ].join("\n");
}

const LOCK_INVOICE_SERIAL = 7_204_512;

const createInvoiceSchema = z.object({
  /** "first" starts the contract (carries setup or licence); "renewal" is
   *  the next period. */
  kind: z.enum(["first", "renewal"]),
  periodStart: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const paySchema = z.object({
  paidAt: z.string().optional(),
  paymentMode: z.enum(["UPI", "NEFT", "RTGS", "IMPS", "CHEQUE", "CASH", "CARD", "OTHER"]),
  paymentRef: z.string().max(120).optional(),
});

export async function billingRoutes(app: FastifyInstance) {
  // ── Apply the chosen plan to the clinic ─────────────────────────────
  app.post("/api/provider/accounts/:id/apply-plan", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const { reason, confirmRemovals } = (request.body ?? {}) as { reason?: string; confirmRemovals?: boolean };

    const account = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!account) return reply.status(404).send({ error: "Not found" });
    if (account.status === "LEAD" || account.status === "CHURNED") {
      return reply.status(400).send({ error: "This clinic has no running deployment to apply a plan to." });
    }

    const plan = account.plan as PlanTier;
    const features = resolveFeatures(plan, account.featureOverrides);

    // What this takes away from what the clinic runs today. An older
    // clinic runs every legacy module until its first apply, so applying
    // its plan as written can switch off a pharmacy it uses daily. That
    // is allowed -- it may be exactly the deal -- but never by surprise.
    const running = runningFeatures(account);
    const removed = running.filter((k) => !features.includes(k));
    if (removed.length > 0 && confirmRemovals !== true) {
      return reply.status(409).send({
        error: `This switches off ${removed.join(", ")} for the clinic, which it has now. Add them to the deal to keep them, or confirm.`,
        removed,
        needsConfirmation: true,
      });
    }
    const readOnly = account.status === "SUSPENDED";
    const maxUsers = account.maxUsersOverride ?? null;

    let jobId: string | null = null;
    let queued = false;
    if (jobsAvailable()) {
      jobId = enqueuePlanSync({ slug: account.slug, plan, features, readOnly, maxUsers });
      queued = true;
    }

    await prisma.$transaction([
      prisma.planChange.create({
        data: {
          accountId: id,
          fromPlan: account.appliedPlan,
          toPlan: plan,
          fromFeatures: account.appliedFeatures,
          toFeatures: features.join(","),
          readOnly,
          reason: reason?.slice(0, 500) || null,
          actorName: auth.name,
          jobId,
        },
      }),
      prisma.clinicAccount.update({
        where: { id },
        // Recorded as applied when queued: the job's own status says
        // whether the server accepted it, and the console shows that.
        data: { appliedPlan: plan, appliedFeatures: features.join(","), appliedReadOnly: readOnly, appliedAt: new Date(), planJobId: jobId },
      }),
      prisma.activityLog.create({
        data: {
          accountId: id, actorId: auth.id, actorName: auth.name, action: "plan.applied",
          detail: `${PLAN_LABELS[plan]}${readOnly ? ", read-only" : ""}: ${features.join(", ")}`,
          applied: queued,
        },
      }),
    ]);

    return reply.status(queued ? 202 : 200).send({
      queued,
      jobId,
      plan,
      features,
      readOnly,
      // Always returned, so an operator without a runner can apply it by
      // hand and one with a runner can see exactly what was asked for.
      envLines: envLines(account.slug, plan, features, readOnly, maxUsers),
      seats: maxUsers === null ? PLAN_MAX_USERS[plan] : maxUsers === 0 ? null : maxUsers,
    });
  });

  app.get("/api/provider/accounts/:id/plan-changes", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const changes = await prisma.planChange.findMany({ where: { accountId: id }, orderBy: { at: "desc" }, take: 50 });
    return { changes };
  });

  // ── Invoices ────────────────────────────────────────────────────────
  app.get("/api/provider/accounts/:id/invoices", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const invoices = await prisma.invoice.findMany({ where: { accountId: id }, orderBy: { createdAt: "desc" } });
    return { invoices };
  });

  app.post("/api/provider/accounts/:id/invoices", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = createInvoiceSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const account = await prisma.clinicAccount.findUnique({ where: { id } });
    if (!account) return reply.status(404).send({ error: "Not found" });

    const contract = contractOf(account);
    const first = parsed.data.kind === "first";
    const periodStart = parsed.data.periodStart
      ? new Date(parsed.data.periodStart)
      : first ? (account.startedAt ?? new Date()) : (account.renewsAt ?? new Date());
    const planLabel = PLAN_LABELS[account.plan as PlanTier];
    const lines = invoiceLines(contract, { first, periodStart, planLabel });
    if (lines.length === 0) {
      return reply.status(400).send({ error: "This account has no fees set for its pricing model, so there is nothing to invoice. Fill in the deal first." });
    }
    const placeOfSupply = stateFromGstin(account.gstin) ?? account.billingState ?? null;
    if (!placeOfSupply) {
      return reply.status(400).send({ error: "Set the clinic's GSTIN or its state first: GST depends on where the clinic is." });
    }
    const totals = invoiceTotals(lines, placeOfSupply === env.PROVIDER_STATE_CODE);

    const invoice = await prisma.invoice.create({
      data: {
        accountId: id,
        status: "DRAFT",
        periodStart,
        isFirst: first,
        billingName: account.billingName ?? account.name,
        billingAddress: account.billingAddress,
        gstin: account.gstin,
        placeOfSupply,
        planLabel,
        lines: lines as never,
        ...totals,
        notes: parsed.data.notes ?? null,
      },
    });
    return reply.status(201).send({ invoice });
  });

  app.delete("/api/provider/invoices/:invoiceId", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { invoiceId } = request.params as { invoiceId: string };
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) return reply.status(404).send({ error: "Not found" });
    if (inv.status !== "DRAFT") {
      return reply.status(409).send({ error: "Only a draft can be deleted. An issued invoice can be voided, never removed." });
    }
    await prisma.invoice.delete({ where: { id: invoiceId } });
    return { ok: true };
  });

  app.post("/api/provider/invoices/:invoiceId/issue", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { invoiceId } = request.params as { invoiceId: string };
    if (!env.PROVIDER_GSTIN) {
      return reply.status(400).send({ error: "Set PROVIDER_GSTIN on the console before issuing: a tax invoice must carry the supplier's GSTIN." });
    }

    const result = await prisma.$transaction(async (tx) => {
      // The lock comes first and the status is read after it: read before,
      // two clicks on Issue both saw DRAFT, queued on the lock, and the
      // second overwrote the first's number -- a gap in the GST series.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_INVOICE_SERIAL})`);
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return { error: 404 as const };
      if (inv.status !== "DRAFT") return { error: 409 as const };
      const now = new Date();
      const fy = financialYear(now);
      const max = await tx.invoice.aggregate({ _max: { serial: true }, where: { fy } });
      const serial = (max._max.serial ?? 0) + 1;
      const dueAt = new Date(now);
      dueAt.setDate(dueAt.getDate() + env.INVOICE_DUE_DAYS);

      const issued = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "ISSUED", fy, serial, number: invoiceNumber(env.INVOICE_PREFIX, now, serial), issuedAt: now, dueAt },
      });

      // The contract now runs to the end of the period this invoice
      // covers, so the renewal list knows when to ask again.
      const account = await tx.clinicAccount.findUnique({ where: { id: inv.accountId } });
      if (account && inv.periodStart) {
        const renewsAt = nextPeriodStart(contractOf(account), inv.periodStart);
        await tx.clinicAccount.update({
          where: { id: account.id },
          data: { renewsAt, ...(inv.isFirst && !account.startedAt ? { startedAt: inv.periodStart } : {}) },
        });
      }
      await tx.activityLog.create({
        data: { accountId: inv.accountId, actorId: auth.id, actorName: auth.name, action: "invoice.issued", detail: `${issued.number}: ₹${Number(issued.total).toLocaleString("en-IN")}` },
      });
      return { invoice: issued };
    });

    if ("error" in result) {
      return result.error === 404
        ? reply.status(404).send({ error: "Not found" })
        : reply.status(409).send({ error: "This invoice has already been issued." });
    }
    return result;
  });

  app.post("/api/provider/invoices/:invoiceId/pay", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { invoiceId } = request.params as { invoiceId: string };
    const parsed = paySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) return reply.status(404).send({ error: "Not found" });
    if (inv.status !== "ISSUED") return reply.status(409).send({ error: "Only an issued, unpaid invoice can be marked paid." });
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
        paymentMode: parsed.data.paymentMode,
        paymentRef: parsed.data.paymentRef ?? null,
      },
    });
    await prisma.activityLog.create({
      data: { accountId: inv.accountId, actorId: auth.id, actorName: auth.name, action: "invoice.paid", detail: `${inv.number} by ${parsed.data.paymentMode}${parsed.data.paymentRef ? ` (${parsed.data.paymentRef})` : ""}` },
    });
    return { invoice };
  });

  app.post("/api/provider/invoices/:invoiceId/void", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const { invoiceId } = request.params as { invoiceId: string };
    const { reason } = (request.body ?? {}) as { reason?: string };
    if (!reason || reason.trim().length < 3) return reply.status(400).send({ error: "Say why it is being voided; the reason is kept with it." });
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) return reply.status(404).send({ error: "Not found" });
    if (inv.status !== "ISSUED") return reply.status(409).send({ error: "Only an issued invoice can be voided. A draft can simply be deleted." });
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VOID", notes: `${inv.notes ? `${inv.notes}\n` : ""}Voided: ${reason.trim().slice(0, 500)}` },
    });
    await prisma.activityLog.create({
      data: { accountId: inv.accountId, actorId: auth.id, actorName: auth.name, action: "invoice.voided", detail: `${inv.number}: ${reason.trim()}` },
    });
    return { invoice };
  });

  /** One invoice, with everything needed to print it. */
  app.get("/api/provider/invoices/:invoiceId", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const { invoiceId } = request.params as { invoiceId: string };
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { account: { select: { name: true, slug: true } } } });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    return {
      invoice,
      supplier: {
        name: env.PROVIDER_LEGAL_NAME,
        address: env.PROVIDER_ADDRESS ?? null,
        gstin: env.PROVIDER_GSTIN ?? null,
        state: env.PROVIDER_STATE_CODE,
        stateName: STATE_CODES[env.PROVIDER_STATE_CODE] ?? null,
        email: env.PROVIDER_EMAIL ?? null,
        phone: env.PROVIDER_PHONE ?? null,
      },
      placeOfSupplyName: invoice.placeOfSupply ? STATE_CODES[invoice.placeOfSupply] ?? null : null,
    };
  });

  /**
   * What needs chasing: renewals coming up, invoices overdue, and money
   * owed. The console's billing page.
   */
  app.get("/api/provider/billing/overview", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const [renewals, unpaid, recent] = await Promise.all([
      prisma.clinicAccount.findMany({
        where: { status: { in: ["LIVE", "SUSPENDED"] }, isDemo: false, renewsAt: { lte: in30 } },
        select: { id: true, name: true, plan: true, renewsAt: true, status: true, pricingModel: true },
        orderBy: { renewsAt: "asc" },
      }),
      prisma.invoice.findMany({
        where: { status: "ISSUED" },
        include: { account: { select: { id: true, name: true } } },
        orderBy: { dueAt: "asc" },
      }),
      prisma.invoice.findMany({
        where: { status: "PAID", paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
        select: { total: true },
      }),
    ]);
    return {
      renewals: renewals.map((r) => ({ ...r, overdue: !!r.renewsAt && r.renewsAt < now })),
      unpaid: unpaid.map((i) => ({ ...i, overdue: !!i.dueAt && i.dueAt < now })),
      owed: unpaid.reduce((s, i) => s + Number(i.total), 0),
      collectedThisMonth: recent.reduce((s, i) => s + Number(i.total), 0),
      supplierReady: !!env.PROVIDER_GSTIN,
    };
  });
}

export { contractOf };
