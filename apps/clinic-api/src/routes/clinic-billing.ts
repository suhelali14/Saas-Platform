import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InvoiceItemCategory, PaymentMode } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireBillingAuth } from "../plugins/auth.js";
import {
  createDocument, drawInfoGrid, drawSectionHeading, drawTable,
  drawTotals, drawSignature, finalizeDocument,
} from "../lib/pdf.js";
import { resolveTemplate } from "../lib/document-template.js";
import { resolveStoredPath } from "../lib/file-storage.js";

/** Rupees on a printed bill. pdfkit's built-in Helvetica has no glyph
 * for the rupee sign, so "Rs." is used deliberately rather than the
 * blank box an unmapped character would print. Grouped Indian-style. */
function money(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const createInvoiceSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
});

const itemSchema = z.object({
  category: z.nativeEnum(InvoiceItemCategory),
  description: z.string().min(1).max(300),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  amount: z.coerce.number().min(0).max(10_000_000),
});

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01).max(10_000_000),
  mode: z.nativeEnum(PaymentMode),
});

const INVOICE_INCLUDE = {
  patient: { select: { id: true, name: true, uhid: true, phone: true } },
  items: true,
  payments: { include: { receivedBy: { select: { name: true } } }, orderBy: { paidAt: "asc" as const } },
};

// Status is computed here, not stored -- one source of truth (see the
// Phase 2 lesson about a stored Clinic.plan column drifting from its real
// enforcement source; same reasoning applies to money).
function summarize(items: { amount: any; quantity: number }[], payments: { amount: any }[]) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.amount) * i.quantity, 0);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, subtotal - paid);
  const status = paid <= 0 ? "PENDING" : balance > 0 ? "PARTIAL" : "PAID";
  return { subtotal, paid, balance, status };
}

export async function clinicBillingRoutes(app: FastifyInstance) {
  app.get("/api/clinic/invoices", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { patientId } = request.query as { patientId?: string };
    const invoices = await prisma.invoice.findMany({
      where: { patientId: patientId || undefined },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data: invoices.map((inv) => ({ ...inv, ...summarize(inv.items, inv.payments) })) };
  });

  app.post("/api/clinic/invoices", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });

    const clinic = await prisma.clinic.findFirst({ select: { defaultConsultationFee: true } });

    const invoice = await prisma.invoice.create({
      data: {
        patientId: parsed.data.patientId,
        appointmentId: parsed.data.appointmentId,
        items: clinic?.defaultConsultationFee
          ? { create: [{ category: "CONSULTATION", description: "Consultation Fee", quantity: 1, amount: clinic.defaultConsultationFee }] }
          : undefined,
      },
      include: INVOICE_INCLUDE,
    });
    return reply.status(201).send({ ...invoice, ...summarize(invoice.items, invoice.payments) });
  });

  app.get("/api/clinic/invoices/:id", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    return { ...invoice, ...summarize(invoice.items, invoice.payments) };
  });

  app.post("/api/clinic/invoices/:id/items", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return reply.status(404).send({ error: "Not found" });

    const parsed = itemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    await prisma.invoiceItem.create({ data: { invoiceId: id, ...parsed.data } });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments) };
  });

  app.delete("/api/clinic/invoices/:id/items/:itemId", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id, itemId } = request.params as { id: string; itemId: string };
    const item = await prisma.invoiceItem.findFirst({ where: { id: itemId, invoiceId: id } });
    if (!item) return reply.status(404).send({ error: "Not found" });

    await prisma.invoiceItem.delete({ where: { id: itemId } });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments) };
  });

  app.post("/api/clinic/invoices/:id/payments", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });

    const parsed = paymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { balance } = summarize(invoice.items, invoice.payments);
    if (parsed.data.amount > balance + 0.01) {
      return reply.status(400).send({ error: `Payment of ${parsed.data.amount} exceeds the remaining balance of ${balance.toFixed(2)}` });
    }

    await prisma.payment.create({ data: { invoiceId: id, amount: parsed.data.amount, mode: parsed.data.mode, receivedById: auth.clinicUserId } });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return reply.status(201).send({ ...updated!, ...summarize(updated!.items, updated!.payments) });
  });

  app.get("/api/clinic/invoices/:id/pdf", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();
    const { subtotal, paid, balance, status } = summarize(invoice.items, invoice.payments);

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="invoice-${id}.pdf"`);

    const branding = {
      name: clinic?.name ?? "Clinic",
      address: clinic?.address,
      phone: clinic?.phone,
      email: clinic?.email,
      registrationNumber: clinic?.registrationNumber,
      logoPath: clinic?.logoPath ? resolveStoredPath(clinic.logoPath) : null,
    };
    // A bill needs a stable human reference for a patient ringing up about
    // it. The cuid tail is short enough to read out over the phone and is
    // already unique.
    const billNo = `INV-${invoice.id.slice(-6).toUpperCase()}`;
    const meta = {
      title: "Invoice",
      reference: billNo,
      date: invoice.createdAt,
      footerNote: status === "PAID" ? "Paid in full. Thank you." : null,
    };
    const template = resolveTemplate(clinic?.documentTemplate);

    const doc = createDocument(branding, meta, template);

    drawInfoGrid(doc, [
      { label: "Patient", value: invoice.patient.name },
      { label: "UHID", value: invoice.patient.uhid },
      { label: "Bill Date", value: invoice.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) },
      { label: "Phone", value: invoice.patient.phone ?? "" },
      { label: "Bill No.", value: billNo },
      { label: "Status", value: status },
    ]);

    drawSectionHeading(doc, "Charges");
    drawTable(
      doc,
      [
        { header: "#", width: 0.06, align: "center" },
        { header: "Description", width: 0.44 },
        { header: "Category", width: 0.18 },
        { header: "Qty", width: 0.1, align: "center" },
        { header: "Amount", width: 0.22, align: "right" },
      ],
      invoice.items.map((item, i) => [
        String(i + 1),
        item.description,
        // Enum values read as shouting on a bill handed to a patient.
        item.category.charAt(0) + item.category.slice(1).toLowerCase(),
        String(item.quantity),
        money(Number(item.amount) * item.quantity),
      ]),
    );

    drawTotals(doc, [
      { label: "Subtotal", value: money(subtotal) },
      { label: "Paid", value: money(paid) },
      { label: balance > 0 ? "Balance Due" : "Balance", value: money(balance), emphasis: true },
    ]);

    // Which payments made up the total, so a patient can reconcile a part
    // payment against their own records without ringing the clinic.
    if (invoice.payments.length > 0) {
      drawSectionHeading(doc, "Payments Received");
      drawTable(
        doc,
        [
          { header: "Date", width: 0.3 },
          { header: "Mode", width: 0.3 },
          { header: "Received By", width: 0.22 },
          { header: "Amount", width: 0.18, align: "right" },
        ],
        invoice.payments.map((p) => [
          p.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          p.mode,
          p.receivedBy?.name ?? "",
          money(Number(p.amount)),
        ]),
      );
    }

    // "Authorised Signatory", not the clinic's own name repeated -- a bill
    // signed "Wellness Family Clinic" over a line labelled "Signature" says
    // nothing about who actually took the money.
    drawSignature(doc, "Authorised Signatory", { qualifications: clinic?.name ?? null });

    finalizeDocument(doc, branding, meta);
    return reply.send(doc);
  });

  // "End of Day Cash Closing" -- totals by payment mode + pending dues for a
  // given day, the exact ask from the user's own prompt.
  app.get("/api/clinic/billing/daily-summary", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { date } = request.query as { date?: string };
    const day = date ? new Date(date) : new Date();
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({ where: { paidAt: { gte: startOfDay, lte: endOfDay } } });
    const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
    for (const p of payments) byMode[p.mode] = (byMode[p.mode] ?? 0) + Number(p.amount);
    const totalCollected = Object.values(byMode).reduce((a, b) => a + b, 0);

    // Pending dues: invoices created *any time* that still have a balance --
    // not scoped to the day, since an unpaid invoice from last week is still
    // owed money today.
    const openInvoices = await prisma.invoice.findMany({ include: INVOICE_INCLUDE });
    const pendingDues = openInvoices.reduce((sum, inv) => sum + summarize(inv.items, inv.payments).balance, 0);

    return { date: startOfDay.toISOString().slice(0, 10), byMode, totalCollected, pendingDues };
  });
}
