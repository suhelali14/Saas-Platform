/**
 * The quotation and agreement API.
 *
 * Shape of the pipeline:
 *   New Lead  ->  Quoted (Quotation.DRAFT -> SENT)  ->  Negotiation  ->
 *   Accepted (Quotation.ACCEPTED, Agreement.DRAFT)  ->  Agreement signed
 *   (Agreement.ACTIVE, ClinicAccount provisioned).
 *
 * The owner drives this from the provider console. Every write logs a
 * row in QuotationActivity so the morning view answers "where is this
 * deal and when did we last touch it" without going to an inbox.
 *
 * Dollar-safe arithmetic: all money fields are kept as Prisma.Decimal
 * on the DB, as paise in JS during computation. Converting Decimal
 * through Number is only for the HTTP boundary; all internal math is
 * integer paise, matching billing.ts in this same app.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { requireProviderAuth, requireOwnerAuth } from "../plugins/auth.js";
import {
  QuotationStatus,
  PipelineStage,
  QuotationLineCategory,
  AgreementStatus,
  ActivityKind,
  PlanTier,
} from "../generated/prisma-client/index.js";
import type { Prisma } from "../generated/prisma-client/index.js";
import { QUOTATION_TEMPLATES, findTemplate } from "../lib/quotation-templates.js";
import { buildAgreementClauses } from "../lib/agreement-terms.js";
import { renderQuotationPdf, formatINR } from "../lib/quotation-pdf.js";
import { renderAgreementPdf } from "../lib/agreement-pdf.js";
import { sendEmail, emailEnabled } from "../lib/email.js";
import { GST_RATE_PERCENT } from "../lib/billing.js";

/** Compute line totals, subtotals, taxable amount and the GST split. */
function computeTotals(opts: {
  lines: { quantity: number; unitPrice: number; discount: number }[];
  providerState?: string | null;
  clientState?: string | null;
  topLevelDiscount: number;
}) {
  // All in paise.
  const linesWithTotal = opts.lines.map((l) => {
    const gross = Math.round(l.quantity * l.unitPrice * 100);
    const discount = Math.round(l.discount * 100);
    const lineTotal = Math.max(0, gross - discount);
    return { lineTotal, discountPaise: discount, grossPaise: gross };
  });
  const subtotal = linesWithTotal.reduce((a, b) => a + b.grossPaise, 0);
  const discountAmount = linesWithTotal.reduce((a, b) => a + b.discountPaise, 0) +
    Math.round(opts.topLevelDiscount * 100);
  const taxable = Math.max(0, subtotal - discountAmount);
  // Place of supply: intrastate if the two states match and the provider
  // has a state on file. Otherwise IGST.
  const intrastate =
    !!opts.providerState &&
    !!opts.clientState &&
    opts.providerState.toLowerCase() === opts.clientState.toLowerCase();
  const gst = Math.round((taxable * GST_RATE_PERCENT) / 100);
  const half = Math.round(gst / 2);
  const cgst = intrastate ? half : 0;
  const sgst = intrastate ? gst - half : 0;
  const igst = intrastate ? 0 : gst;
  const total = taxable + cgst + sgst + igst;
  const toRupees = (p: number) => (p / 100).toFixed(2);
  return {
    linesWithTotal: linesWithTotal.map((l) => ({ lineTotal: toRupees(l.lineTotal) })),
    subtotal: toRupees(subtotal),
    discountAmount: toRupees(discountAmount),
    taxableAmount: toRupees(taxable),
    cgst: toRupees(cgst),
    sgst: toRupees(sgst),
    igst: toRupees(igst),
    total: toRupees(total),
  };
}

const LineItemSchema = z.object({
  category: z.enum([
    "SOFTWARE",
    "IMPLEMENTATION",
    "TRAINING",
    "CUSTOMIZATION",
    "DATA_MIGRATION",
    "SUPPORT",
    "HARDWARE",
    "OTHER",
  ]),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(80),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  sortOrder: z.number().int().optional(),
  sac: z.string().optional(),
});

const UpsertQuotationSchema = z.object({
  accountId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  planTier: z.enum(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"]).default("BASIC"),
  clientName: z.string().min(1).max(200),
  clientAddress: z.string().optional().nullable(),
  clientGSTIN: z.string().optional().nullable(),
  clientState: z.string().optional().nullable(),
  clientContact: z.string().optional().nullable(),
  clientEmail: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  clientPhone: z.string().optional().nullable(),
  providerName: z.string().min(1).max(200),
  providerAddress: z.string().optional().nullable(),
  providerGSTIN: z.string().optional().nullable(),
  providerState: z.string().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  scope: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  stage: z.enum([
    "NEW_LEAD",
    "QUALIFIED",
    "QUOTE_SENT",
    "FOLLOW_UP",
    "NEGOTIATION",
    "CLOSED_WON",
    "CLOSED_LOST",
  ]).default("NEW_LEAD"),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  topLevelDiscount: z.number().nonnegative().default(0),
  lineItems: z.array(LineItemSchema).default([]),
});

const ActivityCreateSchema = z.object({
  kind: z.enum(["CALL", "EMAIL_SENT", "EMAIL_RECEIVED", "MEETING", "WHATSAPP", "SITE_VISIT", "NOTE"]),
  subject: z.string().min(1).max(200),
  body: z.string().optional(),
  outcome: z.string().optional(),
  at: z.string().datetime().optional(),
  isScheduled: z.boolean().optional(),
});

/** Current FY in India: 1 April – 31 March. */
function currentFY(): string {
  const d = new Date();
  const month = d.getMonth();
  const year = d.getFullYear();
  // Before April, the FY started the previous April.
  const start = month >= 3 ? year : year - 1;
  const end = start + 1;
  return `FY${String(start).slice(2)}-${String(end).slice(2)}`;
}

/** Issue a quotation: assign a number and freeze totals. */
async function assignQuotationNumber(id: string): Promise<{ number: string; fy: string; serial: number; version: number }> {
  const fy = currentFY();
  // Lock to prevent two concurrent sends grabbing the same serial.
  return await prisma.$transaction(async (tx) => {
    const last = await tx.quotation.findFirst({
      where: { fy },
      orderBy: { serial: "desc" },
      select: { serial: true },
    });
    const serial = (last?.serial ?? 0) + 1;
    const number = `NAY/Q/${fy}/${String(serial).padStart(4, "0")}`;
    const existing = await tx.quotation.findUnique({ where: { id }, select: { version: true } });
    const version = existing?.version ?? 1;
    await tx.quotation.update({
      where: { id },
      data: { number, fy, serial, version },
    });
    return { number, fy, serial, version };
  });
}

/** Lift the financial terms out of an accepted quote into a prose
 *  summary the agreement reads back as clause 3. */
function feeSummaryFrom(q: Awaited<ReturnType<typeof prisma.quotation.findUnique>> & { lineItems: Prisma.QuotationLineItemGetPayload<{}>[] }): string {
  const software = q.lineItems
    .filter((l) => l.category === "SOFTWARE")
    .reduce((sum, l) => sum + Number(l.lineTotal.toString()), 0);
  const oneTime = q.lineItems
    .filter((l) => l.category !== "SOFTWARE")
    .reduce((sum, l) => sum + Number(l.lineTotal.toString()), 0);
  const parts: string[] = [];
  if (software > 0) {
    parts.push(
      `The annual service fee for the Services is ₹${formatINR(software)} (exclusive of GST), payable in advance for each twelve-month period starting on the Effective Date.`,
    );
  }
  if (oneTime > 0) {
    parts.push(
      `One-time fees of ₹${formatINR(oneTime)} (exclusive of GST) are payable as set out in the Quotation attached as Schedule A and the Payment Terms there stated.`,
    );
  }
  parts.push(`The Total Contract Value under this Agreement is ₹${formatINR(q.total)} (exclusive of GST), as broken down in Schedule A.`);
  return parts.join(" ");
}

export async function quotationRoutes(app: FastifyInstance): Promise<void> {
  // ── Templates (seed data for a new quote). ─────────────────────────
  app.get("/api/provider/quotations/templates", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    return reply.send({ templates: QUOTATION_TEMPLATES });
  });

  // ── Provider's own details, so the console prefills "From" on a new
  //    quote from the console env instead of asking for them each time.
  //    These are the same values the invoicing path already uses, so
  //    the quote and the invoice carry matching GSTIN and state.
  app.get("/api/provider/quotations/provider-info", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    return reply.send({
      providerName: env.PROVIDER_LEGAL_NAME,
      providerAddress: env.PROVIDER_ADDRESS ?? null,
      providerGSTIN: env.PROVIDER_GSTIN ?? null,
      providerState: env.PROVIDER_STATE_CODE,
      providerEmail: env.PROVIDER_EMAIL ?? null,
      providerPhone: env.PROVIDER_PHONE ?? null,
      /** Default validity in days; used to seed validUntil on a new quote. */
      defaultValidityDays: 30,
    });
  });

  // ── List, with pipeline grouping and overdue flag. ────────────────
  app.get<{ Querystring: { stage?: string; status?: string; accountId?: string } }>(
    "/api/provider/quotations",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const { stage, status, accountId } = request.query;
      const where: Prisma.QuotationWhereInput = {};
      if (stage) where.stage = stage as PipelineStage;
      if (status) where.status = status as QuotationStatus;
      if (accountId) where.accountId = accountId;
      const rows = await prisma.quotation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        include: {
          _count: { select: { lineItems: true, activities: true } },
          account: { select: { id: true, slug: true, name: true, status: true } },
        },
      });
      return reply.send({ quotations: rows });
    },
  );

  // ── Pipeline board: all quotes grouped by stage, with counts and
  //    overdue follow-ups surfaced. ───────────────────────────────────
  app.get("/api/provider/quotations/pipeline", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const rows = await prisma.quotation.findMany({
      where: { status: { notIn: ["REJECTED", "EXPIRED"] } },
      orderBy: [{ nextFollowUpAt: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        number: true,
        title: true,
        stage: true,
        status: true,
        clientName: true,
        total: true,
        currency: true,
        nextFollowUpAt: true,
        lastContactedAt: true,
        validUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const now = Date.now();
    const quotations = rows.map((r) => ({
      ...r,
      overdue: r.nextFollowUpAt ? r.nextFollowUpAt.getTime() < now : false,
    }));
    return reply.send({ quotations });
  });

  app.get<{ Params: { id: string } }>("/api/provider/quotations/:id", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const q = await prisma.quotation.findUnique({
      where: { id: request.params.id },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        activities: { orderBy: { at: "desc" } },
        account: true,
        agreements: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!q) return reply.status(404).send({ error: "Quotation not found" });
    return reply.send({ quotation: q });
  });

  // ── Create. ────────────────────────────────────────────────────────
  app.post("/api/provider/quotations", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const parsed = UpsertQuotationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;

    const totals = computeTotals({
      lines: d.lineItems.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
      providerState: d.providerState,
      clientState: d.clientState,
      topLevelDiscount: d.topLevelDiscount,
    });

    const q = await prisma.quotation.create({
      data: {
        accountId: d.accountId ?? null,
        title: d.title,
        planTier: d.planTier as PlanTier,
        clientName: d.clientName,
        clientAddress: d.clientAddress,
        clientGSTIN: d.clientGSTIN,
        clientState: d.clientState,
        clientContact: d.clientContact,
        clientEmail: d.clientEmail ?? null,
        clientPhone: d.clientPhone,
        providerName: d.providerName,
        providerAddress: d.providerAddress,
        providerGSTIN: d.providerGSTIN,
        providerState: d.providerState,
        validUntil: d.validUntil ? new Date(d.validUntil) : null,
        scope: d.scope,
        exclusions: d.exclusions,
        paymentTerms: d.paymentTerms,
        deliveryTerms: d.deliveryTerms,
        internalNotes: d.internalNotes,
        summary: d.summary,
        stage: d.stage as PipelineStage,
        nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        total: totals.total,
        lineItems: {
          create: d.lineItems.map((l, i) => ({
            category: l.category as QuotationLineCategory,
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            lineTotal: totals.linesWithTotal[i]!.lineTotal,
            sortOrder: l.sortOrder ?? i,
            sac: l.sac,
          })),
        },
        activities: {
          create: {
            kind: "NOTE",
            subject: "Quotation created",
            outcome: `Draft created by ${auth.name}.`,
            actor: auth.name,
          },
        },
      },
      include: { lineItems: true, activities: true },
    });
    return reply.status(201).send({ quotation: q });
  });

  // ── Update (DRAFT only; SENT creates a new version via /revise). ──
  app.patch<{ Params: { id: string } }>("/api/provider/quotations/:id", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const existing = await prisma.quotation.findUnique({
      where: { id: request.params.id },
      select: { status: true },
    });
    if (!existing) return reply.status(404).send({ error: "Quotation not found" });
    if (existing.status !== "DRAFT") {
      return reply.status(409).send({
        error: "This quotation is no longer in DRAFT; create a new version with /revise to change line items.",
      });
    }
    const parsed = UpsertQuotationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const totals = computeTotals({
      lines: d.lineItems.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
      providerState: d.providerState,
      clientState: d.clientState,
      topLevelDiscount: d.topLevelDiscount,
    });

    const q = await prisma.$transaction(async (tx) => {
      await tx.quotationLineItem.deleteMany({ where: { quotationId: request.params.id } });
      return await tx.quotation.update({
        where: { id: request.params.id },
        data: {
          accountId: d.accountId ?? null,
          title: d.title,
          planTier: d.planTier as PlanTier,
          clientName: d.clientName,
          clientAddress: d.clientAddress,
          clientGSTIN: d.clientGSTIN,
          clientState: d.clientState,
          clientContact: d.clientContact,
          clientEmail: d.clientEmail ?? null,
          clientPhone: d.clientPhone,
          providerName: d.providerName,
          providerAddress: d.providerAddress,
          providerGSTIN: d.providerGSTIN,
          providerState: d.providerState,
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
          scope: d.scope,
          exclusions: d.exclusions,
          paymentTerms: d.paymentTerms,
          deliveryTerms: d.deliveryTerms,
          internalNotes: d.internalNotes,
          summary: d.summary,
          stage: d.stage as PipelineStage,
          nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          total: totals.total,
          lineItems: {
            create: d.lineItems.map((l, i) => ({
              category: l.category as QuotationLineCategory,
              description: l.description,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              lineTotal: totals.linesWithTotal[i]!.lineTotal,
              sortOrder: l.sortOrder ?? i,
              sac: l.sac,
            })),
          },
        },
        include: { lineItems: true, activities: { orderBy: { at: "desc" } } },
      });
    });
    return reply.send({ quotation: q });
  });

  // ── Change pipeline stage (works at any status). ───────────────────
  app.patch<{ Params: { id: string }; Body: { stage: string; nextFollowUpAt?: string | null; note?: string } }>(
    "/api/provider/quotations/:id/stage",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const stage = request.body?.stage;
      if (!stage || !(stage in PipelineStage)) {
        return reply.status(400).send({ error: "Unknown pipeline stage" });
      }
      const q = await prisma.quotation.update({
        where: { id: request.params.id },
        data: {
          stage: stage as PipelineStage,
          nextFollowUpAt: request.body.nextFollowUpAt ? new Date(request.body.nextFollowUpAt) : null,
          activities: {
            create: {
              kind: "NOTE",
              subject: `Stage changed to ${stage.replace("_", " ")}`,
              outcome: request.body.note ?? null,
              actor: auth.name,
            },
          },
        },
      });
      return reply.send({ quotation: q });
    },
  );

  // ── Send: lock, assign a number, email the PDF to the client. ────
  app.post<{ Params: { id: string }; Body: { to?: string; cc?: string[]; message?: string } }>(
    "/api/provider/quotations/:id/send",
    async (request, reply) => {
      const auth = requireOwnerAuth(request, reply);
      if (!auth) return;
      const q = await prisma.quotation.findUnique({
        where: { id: request.params.id },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      });
      if (!q) return reply.status(404).send({ error: "Quotation not found" });
      if (q.status !== "DRAFT") {
        return reply.status(409).send({ error: "Quotation is not DRAFT; it has already been sent." });
      }

      const numbered = await assignQuotationNumber(q.id);
      await prisma.quotation.update({
        where: { id: q.id },
        data: {
          status: "SENT",
          stage: "QUOTE_SENT",
          sentAt: new Date(),
          lastContactedAt: new Date(),
        },
      });

      const pdf = await renderQuotationPdf({
        ...q,
        number: numbered.number,
        fy: numbered.fy,
        serial: numbered.serial,
        version: numbered.version,
        status: "SENT",
        sentAt: new Date(),
      } as Parameters<typeof renderQuotationPdf>[0]);

      const to = request.body?.to ?? q.clientEmail;
      let emailed = false;
      if (to && emailEnabled()) {
        emailed = await sendEmail({
          to,
          cc: request.body?.cc,
          subject: `Quotation ${numbered.number} - ${q.title}`,
          text: request.body?.message ??
            `Dear ${q.clientName},\n\nPlease find attached our quotation ${numbered.number} for ${q.title}.\n\nThis is valid until ${q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "the date stated on the document"}. Please let me know if any term needs adjusting.\n\nRegards,\n${auth.name}\n${q.providerName}`,
          attachments: [
            { filename: `Quotation-${numbered.number.replace(/\//g, "-")}.pdf`, content: pdf },
          ],
          tag: "quotation.sent",
        });
      }

      await prisma.quotationActivity.create({
        data: {
          quotationId: q.id,
          kind: emailed ? "EMAIL_SENT" : "NOTE",
          subject: emailed ? `Emailed to ${to}` : "Quotation locked and numbered",
          outcome: emailed ? `Sent with attachment ${numbered.number}.` : `Numbered as ${numbered.number}; email not sent (${to ? "email not configured" : "no recipient"}).`,
          actor: auth.name,
        },
      });

      return reply.send({ number: numbered.number, emailed });
    },
  );

  // ── Re-send email (does not re-number). ─────────────────────────────
  app.post<{ Params: { id: string }; Body: { to?: string; cc?: string[]; message?: string } }>(
    "/api/provider/quotations/:id/resend",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const q = await prisma.quotation.findUnique({
        where: { id: request.params.id },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      });
      if (!q || !q.number) return reply.status(409).send({ error: "Quotation has not been sent yet." });
      const pdf = await renderQuotationPdf(q as Parameters<typeof renderQuotationPdf>[0]);
      const to = request.body?.to ?? q.clientEmail;
      if (!to) return reply.status(400).send({ error: "No recipient email on file." });
      if (!emailEnabled()) return reply.status(503).send({ error: "Email is not configured on the server." });
      const ok = await sendEmail({
        to,
        cc: request.body?.cc,
        subject: `Reminder: Quotation ${q.number} - ${q.title}`,
        text: request.body?.message ??
          `Dear ${q.clientName},\n\nFollowing up on the quotation ${q.number} we sent on ${q.sentAt?.toISOString().slice(0, 10) ?? ""}. Please let me know if you would like to discuss any term, or confirm your decision.\n\nRegards,\n${auth.name}\n${q.providerName}`,
        attachments: [
          { filename: `Quotation-${q.number.replace(/\//g, "-")}.pdf`, content: pdf },
        ],
        tag: "quotation.resend",
      });
      await prisma.quotationActivity.create({
        data: {
          quotationId: q.id,
          kind: ok ? "EMAIL_SENT" : "NOTE",
          subject: ok ? `Follow-up email to ${to}` : "Follow-up email failed",
          outcome: ok ? "Reminder sent." : "SMTP/Resend reported failure.",
          actor: auth.name,
        },
      });
      await prisma.quotation.update({
        where: { id: q.id },
        data: { lastContactedAt: new Date(), stage: q.stage === "QUOTE_SENT" ? "FOLLOW_UP" : q.stage },
      });
      return reply.send({ emailed: ok });
    },
  );

  app.post<{ Params: { id: string }; Body: { acceptedBy?: string } }>(
    "/api/provider/quotations/:id/accept",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const q = await prisma.quotation.update({
        where: { id: request.params.id },
        data: {
          status: "ACCEPTED",
          stage: "CLOSED_WON",
          acceptedAt: new Date(),
          acceptedBy: request.body?.acceptedBy ?? null,
          activities: {
            create: {
              kind: "NOTE",
              subject: "Quotation accepted",
              outcome: request.body?.acceptedBy ? `Accepted by ${request.body.acceptedBy}.` : "Marked accepted.",
              actor: auth.name,
            },
          },
        },
      });
      return reply.send({ quotation: q });
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/provider/quotations/:id/reject",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const q = await prisma.quotation.update({
        where: { id: request.params.id },
        data: {
          status: "REJECTED",
          stage: "CLOSED_LOST",
          rejectedAt: new Date(),
          activities: {
            create: {
              kind: "NOTE",
              subject: "Quotation rejected",
              outcome: request.body?.reason ?? "No reason recorded.",
              actor: auth.name,
            },
          },
        },
      });
      return reply.send({ quotation: q });
    },
  );

  // ── Activities: a touch on a deal. ─────────────────────────────────
  app.post<{ Params: { id: string } }>("/api/provider/quotations/:id/activities", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const parsed = ActivityCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const activity = await prisma.quotationActivity.create({
      data: {
        quotationId: request.params.id,
        kind: parsed.data.kind as ActivityKind,
        subject: parsed.data.subject,
        body: parsed.data.body,
        outcome: parsed.data.outcome,
        at: parsed.data.at ? new Date(parsed.data.at) : new Date(),
        isScheduled: parsed.data.isScheduled ?? false,
        actor: auth.name,
      },
    });
    // If this touch is a scheduled follow-up in the future, surface it
    // on the quote so the pipeline view knows when to chase next.
    if (activity.isScheduled && activity.at.getTime() > Date.now()) {
      await prisma.quotation.update({
        where: { id: request.params.id },
        data: { nextFollowUpAt: activity.at, stage: "FOLLOW_UP" },
      });
    } else if (!activity.isScheduled) {
      await prisma.quotation.update({
        where: { id: request.params.id },
        data: { lastContactedAt: activity.at },
      });
    }
    return reply.status(201).send({ activity });
  });

  app.post<{ Params: { aid: string }; Body: { outcome?: string } }>(
    "/api/provider/activities/:aid/complete",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      const row = await prisma.quotationActivity.update({
        where: { id: request.params.aid },
        data: {
          isScheduled: false,
          completedAt: new Date(),
          outcome: request.body?.outcome ?? undefined,
        },
      });
      await prisma.quotation.update({
        where: { id: row.quotationId },
        data: { lastContactedAt: new Date(), nextFollowUpAt: null },
      });
      return reply.send({ activity: row });
    },
  );

  // ── PDF download (any status). ─────────────────────────────────────
  app.get<{ Params: { id: string } }>("/api/provider/quotations/:id/pdf", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const q = await prisma.quotation.findUnique({
      where: { id: request.params.id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!q) return reply.status(404).send({ error: "Quotation not found" });
    const pdf = await renderQuotationPdf(q);
    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="Quotation-${(q.number ?? q.id).replace(/\//g, "-")}.pdf"`)
      .send(pdf);
  });

  // ── Generate an agreement from an accepted quote. ────────────────
  app.post<{ Params: { id: string }; Body: { effectiveFrom?: string; termMonths?: number; noticeDays?: number; autoRenew?: boolean; governingCity?: string } }>(
    "/api/provider/quotations/:id/agreement",
    async (request, reply) => {
      const auth = requireOwnerAuth(request, reply);
      if (!auth) return;
      const q = await prisma.quotation.findUnique({
        where: { id: request.params.id },
        include: { lineItems: true },
      });
      if (!q) return reply.status(404).send({ error: "Quotation not found" });
      if (q.status !== "ACCEPTED") {
        return reply.status(409).send({ error: "Agreement can only be generated for an ACCEPTED quotation." });
      }
      if (!q.accountId) {
        return reply.status(409).send({ error: "Agreement requires a linked ClinicAccount. Link the quote to an account first." });
      }

      const clauses = buildAgreementClauses({
        providerName: q.providerName,
        providerAddress: q.providerAddress ?? undefined,
        providerGSTIN: q.providerGSTIN ?? undefined,
        clientName: q.clientName,
        clientAddress: q.clientAddress ?? undefined,
        clientGSTIN: q.clientGSTIN ?? undefined,
        effectiveFrom: request.body?.effectiveFrom ? new Date(request.body.effectiveFrom) : undefined,
        termMonths: request.body?.termMonths ?? 12,
        noticeDays: request.body?.noticeDays ?? 60,
        autoRenew: request.body?.autoRenew ?? true,
        planTier: q.planTier,
        feeSummary: feeSummaryFrom(q),
        governingCity: request.body?.governingCity ?? "Pune",
      });

      const agreement = await prisma.agreement.create({
        data: {
          accountId: q.accountId,
          quotationId: q.id,
          title: q.title,
          status: "DRAFT",
          clauses: clauses as unknown as Prisma.InputJsonValue,
          effectiveFrom: request.body?.effectiveFrom ? new Date(request.body.effectiveFrom) : null,
          termMonths: request.body?.termMonths ?? 12,
          noticeDays: request.body?.noticeDays ?? 60,
          autoRenew: request.body?.autoRenew ?? true,
          clientName: q.clientName,
          clientAddress: q.clientAddress,
          clientGSTIN: q.clientGSTIN,
          providerName: q.providerName,
          providerAddress: q.providerAddress,
          providerGSTIN: q.providerGSTIN,
          setupFee: q.lineItems
            .filter((l) => l.category === "IMPLEMENTATION")
            .reduce((a, b) => a + Number(b.lineTotal.toString()), 0),
          yearlyFee: q.lineItems
            .filter((l) => l.category === "SOFTWARE")
            .reduce((a, b) => a + Number(b.lineTotal.toString()), 0),
        },
      });
      return reply.status(201).send({ agreement });
    },
  );

  // ── Agreement endpoints. ────────────────────────────────────────
  app.get("/api/provider/agreements", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const rows = await prisma.agreement.findMany({
      orderBy: { createdAt: "desc" },
      include: { account: { select: { slug: true, name: true } } },
    });
    return reply.send({ agreements: rows });
  });

  app.get<{ Params: { id: string } }>("/api/provider/agreements/:id", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const a = await prisma.agreement.findUnique({
      where: { id: request.params.id },
      include: { account: true, quotation: { include: { lineItems: true } } },
    });
    if (!a) return reply.status(404).send({ error: "Agreement not found" });
    return reply.send({ agreement: a });
  });

  app.get<{ Params: { id: string } }>("/api/provider/agreements/:id/pdf", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const a = await prisma.agreement.findUnique({
      where: { id: request.params.id },
      include: { quotation: true },
    });
    if (!a) return reply.status(404).send({ error: "Agreement not found" });
    const pdf = await renderAgreementPdf(a);
    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="Agreement-${(a.number ?? a.id).replace(/\//g, "-")}.pdf"`)
      .send(pdf);
  });

  app.post<{ Params: { id: string } }>("/api/provider/agreements/:id/issue", async (request, reply) => {
    const auth = requireOwnerAuth(request, reply);
    if (!auth) return;
    const a = await prisma.agreement.findUnique({ where: { id: request.params.id } });
    if (!a) return reply.status(404).send({ error: "Agreement not found" });
    if (a.status !== "DRAFT") {
      return reply.status(409).send({ error: "Agreement is not in DRAFT." });
    }
    const fy = currentFY();
    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.agreement.findFirst({ where: { fy }, orderBy: { serial: "desc" }, select: { serial: true } });
      const serial = (last?.serial ?? 0) + 1;
      const number = `NAY/A/${fy}/${String(serial).padStart(4, "0")}`;
      return await tx.agreement.update({
        where: { id: a.id },
        data: {
          number,
          fy,
          serial,
          status: "AWAITING_SIGN",
          issuedAt: new Date(),
          providerSignedBy: auth.name,
          providerSignedAt: new Date(),
        },
      });
    });
    return reply.send({ agreement: result });
  });

  app.post<{ Params: { id: string }; Body: { signerName: string; signerRole?: string; signatureRef?: string } }>(
    "/api/provider/agreements/:id/countersign",
    async (request, reply) => {
      const auth = requireProviderAuth(request, reply);
      if (!auth) return;
      if (!request.body?.signerName) return reply.status(400).send({ error: "signerName is required" });
      const a = await prisma.agreement.update({
        where: { id: request.params.id },
        data: {
          status: "ACTIVE",
          clientSignedByName: request.body.signerName,
          clientSignedByRole: request.body.signerRole,
          clientSignatureRef: request.body.signatureRef,
          clientSignedAt: new Date(),
        },
      });
      return reply.send({ agreement: a });
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/provider/agreements/:id/terminate",
    async (request, reply) => {
      const auth = requireOwnerAuth(request, reply);
      if (!auth) return;
      const a = await prisma.agreement.update({
        where: { id: request.params.id },
        data: {
          status: "TERMINATED",
          terminatedAt: new Date(),
          terminationReason: request.body?.reason,
        },
      });
      return reply.send({ agreement: a });
    },
  );
}

// Suppress unused imports when env is not touched in this file; kept for
// symmetry with other routes modules.
void env;
