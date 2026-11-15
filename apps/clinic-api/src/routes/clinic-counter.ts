import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { COUNTER_ROLES, requireClinicAuth, requireRoles } from "../plugins/auth.js";
import { summarize } from "./clinic-billing.js";

/**
 * The cash counter.
 *
 * A cashier opens a counter with the cash in the drawer, takes payments
 * and deposits on it, and closes it by counting what is there. Only the
 * person who opened a counter takes money on it, so every rupee belongs
 * to one person's shift and the close can be checked.
 *
 * Deposits are a ledger per patient: an advance in, a refund out, or part
 * of the advance applied to a bill. The balance is worked out from the
 * ledger every time and never stored.
 */

const money = z.coerce.number().min(0).max(10_000_000);

async function staffName(id: string) {
  return (await prisma.clinicUser.findUnique({ where: { id }, select: { name: true } }))?.name ?? "Staff";
}

/** What the counter's drawer should hold now. */
async function sessionTotals(sessionId: string, openingCash: number) {
  const [payments, deposits] = await Promise.all([
    prisma.payment.findMany({ where: { counterSessionId: sessionId }, select: { amount: true, mode: true } }),
    prisma.deposit.findMany({ where: { counterSessionId: sessionId }, select: { amount: true, mode: true, kind: true } }),
  ]);
  const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
  for (const p of payments) byMode[p.mode] = (byMode[p.mode] ?? 0) + Number(p.amount);
  let advances = 0;
  let refunds = 0;
  for (const d of deposits) {
    if (!d.mode) continue;
    const amt = Number(d.amount);
    if (d.kind === "ADVANCE") { byMode[d.mode] = (byMode[d.mode] ?? 0) + amt; advances += amt; }
    if (d.kind === "REFUND") { byMode[d.mode] = (byMode[d.mode] ?? 0) - amt; refunds += amt; }
  }
  return {
    byMode,
    advances,
    refunds,
    receipts: payments.length + deposits.length,
    expectedCash: Math.round((openingCash + (byMode.CASH ?? 0)) * 100) / 100,
  };
}

/** A patient's advance: in, refunded, applied, and what is left. */
export async function depositBalance(patientId: string, admissionId?: string | null) {
  const rows = await prisma.deposit.findMany({ where: { patientId, ...(admissionId ? { admissionId } : {}) }, orderBy: { at: "asc" } });
  let held = 0;
  for (const r of rows) held += r.kind === "ADVANCE" ? Number(r.amount) : -Number(r.amount);
  return { held: Math.round(held * 100) / 100, entries: rows };
}

export async function clinicCounterRoutes(app: FastifyInstance) {
  /** The counter this person has open, if any, with its running totals. */
  app.get("/api/clinic/counter/current", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can use the cash counter.");
    if (!auth) return;
    const session = await prisma.counterSession.findFirst({ where: { openedById: auth.clinicUserId, closedAt: null } });
    if (!session) return { session: null };
    const totals = await sessionTotals(session.id, Number(session.openingCash));
    const recent = await prisma.$transaction([
      prisma.payment.findMany({ where: { counterSessionId: session.id }, orderBy: { paidAt: "desc" }, take: 15, include: { invoice: { select: { id: true, patient: { select: { name: true, uhid: true } } } } } }),
      prisma.deposit.findMany({ where: { counterSessionId: session.id }, orderBy: { at: "desc" }, take: 15, include: { patient: { select: { name: true, uhid: true } } } }),
    ]);
    return { session, totals, payments: recent[0], deposits: recent[1] };
  });

  app.post("/api/clinic/counter/open", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can open a counter.");
    if (!auth) return;
    const parsed = z.object({ counterName: z.string().trim().min(1).max(60), openingCash: money }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Name the counter and say how much cash is in the drawer." });
    const open = await prisma.counterSession.findFirst({ where: { openedById: auth.clinicUserId, closedAt: null } });
    if (open) return reply.status(409).send({ error: `You already have ${open.counterName} open. Close it first.` });
    const session = await prisma.counterSession.create({
      data: { counterName: parsed.data.counterName, openingCash: parsed.data.openingCash, openedById: auth.clinicUserId, openedByName: await staffName(auth.clinicUserId) },
    });
    return reply.status(201).send({ session });
  });

  /** Close: count the drawer, record what it should have held. */
  app.post("/api/clinic/counter/close", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can close a counter.");
    if (!auth) return;
    const parsed = z.object({ countedCash: money, notes: z.string().max(500).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Count the cash in the drawer and enter it." });
    const session = await prisma.counterSession.findFirst({ where: { openedById: auth.clinicUserId, closedAt: null } });
    if (!session) return reply.status(409).send({ error: "You have no counter open." });
    const totals = await sessionTotals(session.id, Number(session.openingCash));
    const difference = Math.round((parsed.data.countedCash - totals.expectedCash) * 100) / 100;
    if (difference !== 0 && !parsed.data.notes?.trim()) {
      return reply.status(400).send({ error: `The drawer is ${difference > 0 ? "over" : "short"} by ₹${Math.abs(difference)}. Add a note saying why before closing.`, difference });
    }
    const closed = await prisma.counterSession.update({
      where: { id: session.id },
      data: { closedAt: new Date(), closedByName: await staffName(auth.clinicUserId), countedCash: parsed.data.countedCash, expectedCash: totals.expectedCash, notes: parsed.data.notes ?? null },
    });
    return { session: closed, totals, difference };
  });

  /** Past counter sessions, newest first: the day-close register. */
  app.get("/api/clinic/counter/sessions", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can see counter sessions.");
    if (!auth) return;
    const sessions = await prisma.counterSession.findMany({
      where: auth.isAdmin ? {} : { openedById: auth.clinicUserId },
      orderBy: { openedAt: "desc" },
      take: 60,
    });
    return {
      data: sessions.map((s) => ({
        ...s,
        difference: s.countedCash !== null && s.expectedCash !== null ? Math.round((Number(s.countedCash) - Number(s.expectedCash)) * 100) / 100 : null,
      })),
    };
  });

  // ── Deposits ────────────────────────────────────────────────────────

  app.get("/api/clinic/patients/:id/deposits", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    return depositBalance(id);
  });

  /** An advance or a refund, taken at the person's open counter. */
  app.post("/api/clinic/deposits", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can take deposits.");
    if (!auth) return;
    const parsed = z.object({
      patientId: z.string().min(1),
      admissionId: z.string().optional(),
      kind: z.enum(["ADVANCE", "REFUND"]),
      amount: money.refine((v) => v > 0, "Amount must be more than zero"),
      mode: z.enum(["CASH", "UPI", "CARD"]),
      notes: z.string().max(300).optional(),
    }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const session = await prisma.counterSession.findFirst({ where: { openedById: auth.clinicUserId, closedAt: null } });
    if (!session) return reply.status(409).send({ error: "Open your counter first." });
    const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true } });
    if (!patient) return reply.status(404).send({ error: "Patient not found" });
    if (parsed.data.kind === "REFUND") {
      const { held } = await depositBalance(parsed.data.patientId, parsed.data.admissionId);
      if (parsed.data.amount > held + 0.001) {
        return reply.status(400).send({ error: `Only ₹${held} of advance is held for this patient; a refund cannot be more than that.` });
      }
    }
    const deposit = await prisma.deposit.create({
      data: { ...parsed.data, counterSessionId: session.id, byId: auth.clinicUserId, byName: await staffName(auth.clinicUserId) },
    });
    return reply.status(201).send({ deposit, ...(await depositBalance(parsed.data.patientId)) });
  });

  /** Pay a bill from the patient's advance: no new money, so no counter. */
  app.post("/api/clinic/invoices/:id/apply-deposit", async (request, reply) => {
    const auth = requireRoles(request, reply, COUNTER_ROLES, "Only counter staff can apply deposits.");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = z.object({ amount: money.refine((v) => v > 0) }).safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Say how much of the advance to use." });
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, payments: true } });
    if (!invoice) return reply.status(404).send({ error: "Not found" });
    const { balance } = summarize(invoice.items, invoice.payments, invoice);
    const { held } = await depositBalance(invoice.patientId);
    const amount = Math.min(parsed.data.amount, balance, held);
    if (amount <= 0) return reply.status(400).send({ error: held <= 0 ? "This patient has no advance held." : "This bill has nothing left to pay." });
    const byName = await staffName(auth.clinicUserId);
    await prisma.$transaction([
      prisma.payment.create({ data: { invoiceId: id, amount, mode: "DEPOSIT", receivedById: auth.clinicUserId } }),
      prisma.deposit.create({ data: { patientId: invoice.patientId, admissionId: invoice.admissionId, kind: "APPLIED", amount, invoiceId: id, byId: auth.clinicUserId, byName } }),
    ]);
    return { applied: amount, ...(await depositBalance(invoice.patientId)) };
  });
}
