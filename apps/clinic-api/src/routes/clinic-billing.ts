import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InvoiceItemCategory, PaymentMode } from "../generated/prisma-client/index.js";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireBillingAuth, requireAdminAuth } from "../plugins/auth.js";
import {
  createDocument, drawInfoGrid, drawSectionHeading, drawTable,
  drawTotals, drawSignature, finalizeDocument,
} from "../lib/pdf.js";
import { resolveTemplate } from "../lib/document-template.js";
import { resolveStoredPath } from "../lib/file-storage.js";
import { isFeatureEnabled } from "../config/features.js";
import { lockMoney } from "../lib/money-lock.js";

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

/**
 * A line on an invoice.
 *
 * Three ways in:
 *   1. Everything spelled out -- category + description + amount -- for
 *      the one-off line a doctor types freely. This is the historical
 *      path and still works.
 *   2. `serviceItemId` picked from the clinic's / doctor's catalogue
 *      ("bill board"). The description / amount / category are filled
 *      in from the catalogue entry; any field sent explicitly overrides
 *      the catalogue (because the board is the default, the bill is
 *      where negotiation lives).
 *   3. `appointmentId` attaches this line to a specific visit, so a
 *      multi-visit episode bill can group lines by date on the printed
 *      receipt.
 *
 * Catalogue-only requests are the common case now; the explicit fields
 * become optional in that path.
 */
const itemSchema = z
  .object({
    serviceItemId: z.string().optional(),
    appointmentId: z.string().optional(),
    category: z.nativeEnum(InvoiceItemCategory).optional(),
    description: z.string().min(1).max(300).optional(),
    quantity: z.coerce.number().int().min(1).max(1000).default(1),
    amount: z.coerce.number().min(0).max(10_000_000).optional(),
  })
  .refine(
    (v) => v.serviceItemId || (v.category && v.description && v.amount !== undefined),
    { message: "Either pick a service item, or supply category + description + amount." },
  );

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
/**
 * An invoice's money, computed.
 *
 * Status is deliberately never stored: it is a function of the payments
 * against the total, and a stored copy would be one more thing that can
 * disagree with the rows it summarises. Exported so every screen that
 * needs a balance gets the same arithmetic.
 */
export function summarize(
  items: { amount: any; quantity: number }[],
  payments: { amount: any }[],
  inv?: { discount?: any; discountStatus?: string | null },
) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.amount) * i.quantity, 0);
  // Only an approved discount reduces what is owed. A pending one is shown
  // as pending; counting it early would let a bill be "paid" before anyone
  // agreed to the discount that made it so.
  const discount = inv?.discountStatus === "APPROVED" ? Math.min(Number(inv.discount ?? 0), subtotal) : 0;
  const total = subtotal - discount;
  const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(0, total - paid);
  // A bill with nothing on it yet is pending, not paid. One brought to
  // nothing by an approved discount is paid: nothing more is owed.
  const status = subtotal <= 0 ? "PENDING" : balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  // "discountApplied", not "discount": callers spread this over the
  // invoice, and a field named discount would overwrite the amount that
  // was asked for with 0 while it waits for approval.
  return { subtotal, discountApplied: discount, total, paid, balance, status };
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
    return { data: invoices.map((inv) => ({ ...inv, ...summarize(inv.items, inv.payments, inv) })) };
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
    return reply.status(201).send({ ...invoice, ...summarize(invoice.items, invoice.payments, invoice) });
  });

  app.get("/api/clinic/invoices/:id", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    return { ...invoice, ...summarize(invoice.items, invoice.payments, invoice) };
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

    // If a ServiceItem was picked, fill in the fields not explicitly
    // overridden in the request. Explicit fields always win -- the
    // board's price is a default, not a lock.
    let { serviceItemId, appointmentId, category, description, amount, quantity } = parsed.data;
    if (serviceItemId) {
      const si = await prisma.serviceItem.findUnique({ where: { id: serviceItemId } });
      if (!si || !si.isActive) {
        return reply.status(400).send({ error: "Service item not found or inactive." });
      }
      category = category ?? si.category;
      description = description ?? (si.code ? `${si.name} (${si.code})` : si.name);
      amount = amount ?? Number(si.defaultPrice.toString());
    }

    await prisma.invoiceItem.create({
      data: {
        invoiceId: id,
        category: category as InvoiceItemCategory,
        description: description!,
        quantity: quantity,
        amount: amount!,
        serviceItemId: serviceItemId ?? null,
        appointmentId: appointmentId ?? invoice.appointmentId ?? null,
      },
    });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments, updated!) };
  });

  /**
   * Visit-centric invoice -- the "charge-before-close" entrypoint.
   *
   * Returns the invoice for this appointment, creating one if the visit
   * doesn't yet have one. This is what the Encounter screen hits so the
   * doctor / receptionist can add charges and take payment WITHOUT
   * leaving the visit to navigate to Billing. For clinics without a
   * dedicated cashier module, this is the billing UI.
   *
   * The invoice gets the clinic's default consultation fee pre-loaded
   * on first creation, same as POST /invoices does, since every visit
   * at least charges for the consultation. Subsequent calls return the
   * same invoice -- idempotent by appointment.
   */
  app.get("/api/clinic/appointments/:id/invoice", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patientId: true },
    });
    if (!appointment) return reply.status(404).send({ error: "Appointment not found" });

    const existing = await prisma.invoice.findFirst({
      where: { appointmentId: id },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { ...existing, ...summarize(existing.items, existing.payments, existing) };

    const clinic = await prisma.clinic.findFirst({ select: { defaultConsultationFee: true } });
    const created = await prisma.invoice.create({
      data: {
        patientId: appointment.patientId,
        appointmentId: id,
        items: clinic?.defaultConsultationFee
          ? { create: [{ category: "CONSULTATION", description: "Consultation Fee", quantity: 1, amount: clinic.defaultConsultationFee, appointmentId: id }] }
          : undefined,
      },
      include: INVOICE_INCLUDE,
    });
    return reply.status(201).send({ ...created, ...summarize(created.items, created.payments, created) });
  });

  app.delete("/api/clinic/invoices/:id/items/:itemId", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id, itemId } = request.params as { id: string; itemId: string };
    const item = await prisma.invoiceItem.findFirst({ where: { id: itemId, invoiceId: id } });
    if (!item) return reply.status(404).send({ error: "Not found" });

    await prisma.invoiceItem.delete({ where: { id: itemId } });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments, updated!) };
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

    const { balance } = summarize(invoice.items, invoice.payments, invoice);
    if (parsed.data.amount > balance + 0.01) {
      return reply.status(400).send({ error: `Payment of ${parsed.data.amount} exceeds the remaining balance of ${balance.toFixed(2)}` });
    }

    // With a cash counter, money is taken at an open counter, by the
    // person who opened it -- so every rupee belongs to a shift that can
    // be counted at close. A bill settled from the patient's advance is
    // not new money and needs no counter.
    let counterSessionId: string | null = null;
    if (isFeatureEnabled("cashcounter") && parsed.data.mode !== "DEPOSIT") {
      const open = await prisma.counterSession.findFirst({ where: { openedById: auth.clinicUserId, closedAt: null } });
      if (!open) return reply.status(409).send({ error: "Open your counter before taking a payment (Cash counter → Open counter)." });
      counterSessionId = open.id;
    }
    if (parsed.data.mode === "DEPOSIT") {
      return reply.status(400).send({ error: "Use the patient's advance from the cash counter, so the deposit ledger is updated too." });
    }

    // The balance is read again under a lock on this bill, so two payments
    // at once (a double tap, two counters) cannot both fit into it.
    const over = await prisma.$transaction(async (tx) => {
      await lockMoney(tx, `invoice:${id}`);
      const fresh = (await tx.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE }))!;
      const { balance: now } = summarize(fresh.items, fresh.payments, fresh);
      if (parsed.data.amount > now + 0.01) return now;
      await tx.payment.create({ data: { invoiceId: id, amount: parsed.data.amount, mode: parsed.data.mode, receivedById: auth.clinicUserId, counterSessionId } });
      return null;
    });
    if (over !== null) {
      return reply.status(400).send({ error: `Payment of ${parsed.data.amount} exceeds the remaining balance of ${over.toFixed(2)}` });
    }
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return reply.status(201).send({ ...updated!, ...summarize(updated!.items, updated!.payments, updated!) });
  });

  app.get("/api/clinic/invoices/:id/pdf", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });

    const clinic = await prisma.clinic.findFirst();
    const { subtotal, discountApplied: discount, paid, balance, status } = summarize(invoice.items, invoice.payments, invoice);

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
      ...(discount > 0 ? [{ label: `Discount${invoice.discountReason ? ` (${invoice.discountReason})` : ""}`, value: `- ${money(discount)}` }] : []),
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

    // Money in today, by how it came. A bill paid from an advance is left
    // out -- that money was counted the day the advance was taken -- and
    // advances taken and refunds given today are counted, because they
    // are cash in and out of the drawer like any payment.
    const [payments, deposits] = await Promise.all([
      prisma.payment.findMany({ where: { paidAt: { gte: startOfDay, lte: endOfDay }, mode: { not: "DEPOSIT" } } }),
      prisma.deposit.findMany({ where: { at: { gte: startOfDay, lte: endOfDay }, kind: { in: ["ADVANCE", "REFUND"] } } }),
    ]);
    const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
    for (const p of payments) byMode[p.mode] = (byMode[p.mode] ?? 0) + Number(p.amount);
    for (const d of deposits) {
      if (!d.mode || d.mode === "DEPOSIT") continue;
      byMode[d.mode] = (byMode[d.mode] ?? 0) + (d.kind === "ADVANCE" ? Number(d.amount) : -Number(d.amount));
    }
    const totalCollected = Object.values(byMode).reduce((a, b) => a + b, 0);

    // Pending dues: invoices created *any time* that still have a balance --
    // not scoped to the day, since an unpaid invoice from last week is still
    // owed money today.
    const openInvoices = await prisma.invoice.findMany({ include: INVOICE_INCLUDE });
    const pendingDues = openInvoices.reduce((sum, inv) => sum + summarize(inv.items, inv.payments, inv).balance, 0);

    return { date: startOfDay.toISOString().slice(0, 10), byMode, totalCollected, pendingDues };
  });

  /*
   * A discount on a bill.
   *
   * At or under the clinic's limit it is approved as it is asked; above it,
   * it waits for an admin. Uncontrolled discounting at the counter is
   * revenue walking out of the door, and a discount nobody approved should
   * not quietly settle a bill.
   */
  app.post("/api/clinic/invoices/:id/discount", async (request, reply) => {
    const auth = requireBillingAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ amount: z.coerce.number().min(0).max(10_000_000), reason: z.string().min(3).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Give an amount and a reason for the discount." });
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    const { subtotal, paid } = summarize(invoice.items, invoice.payments, invoice);
    if (parsed.data.amount > subtotal) return reply.status(400).send({ error: "A discount cannot be more than the bill." });
    // Nor more than is still owed. Past that the patient has overpaid, and
    // the difference is a refund to give back at the counter -- a discount
    // would make that money vanish from every total instead.
    const owed = Math.max(0, subtotal - paid);
    if (parsed.data.amount > owed) {
      return reply.status(400).send({ error: `Only ${owed.toFixed(2)} is still owed on this bill, so the discount can be at most that. Anything beyond it is a refund.` });
    }
    const clinic = await prisma.clinic.findFirst({ select: { discountApprovalAbove: true } });
    const limit = clinic?.discountApprovalAbove === null || clinic?.discountApprovalAbove === undefined ? 0 : Number(clinic.discountApprovalAbove);
    const me = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId }, select: { name: true } });
    const autoApprove = parsed.data.amount === 0 || parsed.data.amount <= limit || auth.isAdmin;
    await prisma.invoice.update({
      where: { id },
      data: {
        discount: parsed.data.amount,
        discountReason: parsed.data.reason,
        discountStatus: parsed.data.amount === 0 ? "NONE" : autoApprove ? "APPROVED" : "PENDING",
        discountRequestedBy: me?.name ?? null,
        discountApprovedBy: autoApprove && parsed.data.amount > 0 ? me?.name ?? null : null,
      },
    });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments, updated!), needsApproval: !autoApprove };
  });

  app.post("/api/clinic/invoices/:id/discount/decision", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const { approve } = (request.body ?? {}) as { approve?: boolean };
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    if (invoice.discountStatus !== "PENDING") return reply.status(409).send({ error: "There is no discount waiting for approval on this bill." });
    // A pending discount does not reduce the balance, so the bill may have
    // been paid in full while it waited. Approving it then would turn the
    // patient's overpayment into money that appears nowhere.
    if (approve) {
      const { subtotal, paid } = summarize(invoice.items, invoice.payments, invoice);
      const owed = Math.max(0, subtotal - paid);
      if (Number(invoice.discount ?? 0) > owed) {
        return reply.status(409).send({ error: `This bill has been paid since the discount was asked for; only ${owed.toFixed(2)} is still owed. Turn the discount down, and refund any difference at the counter.` });
      }
    }
    const me = await prisma.clinicUser.findUnique({ where: { id: auth.clinicUserId }, select: { name: true } });
    await prisma.invoice.update({
      where: { id },
      data: { discountStatus: approve ? "APPROVED" : "REJECTED", discountApprovedBy: me?.name ?? null },
    });
    const updated = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    return { ...updated!, ...summarize(updated!.items, updated!.payments, updated!) };
  });

  /** Discounts waiting for an admin. */
  app.get("/api/clinic/discounts/pending", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;
    const invoices = await prisma.invoice.findMany({ where: { discountStatus: "PENDING" }, include: INVOICE_INCLUDE, orderBy: { updatedAt: "asc" } });
    return { data: invoices.map((inv) => ({ ...inv, ...summarize(inv.items, inv.payments, inv) })) };
  });
}
