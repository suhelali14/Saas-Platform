import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdminAuth, requireRoles } from "../plugins/auth.js";
import { summarize } from "./clinic-billing.js";

/**
 * Expense ledger + profit/loss -- the other half of the SRS's billing
 * module. Phase 4 built the revenue side; without expenses the doctor can
 * see what came in but never what the clinic actually earned.
 *
 * Categories are a fixed list rather than free text: a ledger where the
 * same cost is typed "elec", "Electricity" and "electricity bill" can't be
 * summed, which defeats the only reason to keep one.
 */
export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Electricity",
  "Water",
  "Medical Supplies",
  "Pharmacy Stock",
  "Equipment",
  "Maintenance",
  "Lab Charges",
  "Marketing",
  "Insurance",
  "Taxes & Licences",
  "Other",
] as const;

const createSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1).max(300),
  amount: z.coerce.number().positive().max(10_000_000),
  paidAt: z.string().min(1),
  paymentMode: z.enum(["CASH", "UPI", "CARD"]).default("CASH"),
  vendor: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

/** Inclusive of the whole end day -- a range picker's "to" date means that
 * day, not its opening midnight. Same reasoning as the audit filters. */
function dayRange(from?: string, to?: string) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Who may read and add to the expense ledger: the people who ran the money
 * before hospitals existed. Not the shared billing set -- a cashier or a
 * billing clerk takes payments on bills, which is not the clinic's own
 * spending, so they are deliberately left out here even though they bill.
 */
const EXPENSE_ROLES = new Set(["RECEPTIONIST", "DOCTOR", "ADMIN"]);
const requireExpenseAuth = (request: Parameters<typeof requireRoles>[0], reply: Parameters<typeof requireRoles>[1]) =>
  requireRoles(request, reply, EXPENSE_ROLES, "Only reception, doctors and admins keep the expense ledger.", { allowAdmin: true });

export async function clinicExpenseRoutes(app: FastifyInstance) {
  app.get("/api/clinic/expenses/categories", async (request, reply) => {
    const auth = requireExpenseAuth(request, reply);
    if (!auth) return;
    return { categories: EXPENSE_CATEGORIES };
  });

  app.get("/api/clinic/expenses", async (request, reply) => {
    const auth = requireExpenseAuth(request, reply);
    if (!auth) return;

    const { from, to, category } = request.query as { from?: string; to?: string; category?: string };
    const { start, end } = dayRange(from, to);

    const expenses = await prisma.expense.findMany({
      where: { paidAt: { gte: start, lte: end }, ...(category ? { category } : {}) },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
    }

    return {
      expenses,
      total,
      byCategory: [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      from: start.toISOString(),
      to: end.toISOString(),
    };
  });

  app.post("/api/clinic/expenses", async (request, reply) => {
    const auth = requireExpenseAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { amount, paidAt, ...rest } = parsed.data;

    const expense = await prisma.expense.create({
      data: { ...rest, amount, paidAt: new Date(paidAt), recordedById: auth.clinicUserId },
      include: { recordedBy: { select: { name: true } } },
    });
    return reply.status(201).send(expense);
  });

  // Deleting a financial record is a doctor/admin decision, not
  // reception's -- an expense that can be quietly removed by whoever
  // entered it is a hole in the clinic's own books.
  app.delete("/api/clinic/expenses/:id", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.expense.delete({ where: { id } });
    return { ok: true };
  });

  /**
   * Profit & loss for a period. Revenue is counted from *payments actually
   * received*, not from invoices raised -- an unpaid invoice is not income,
   * and treating it as such would tell the doctor the clinic earned money
   * it has never seen. This is cash-basis accounting, which is what a
   * single-doctor clinic actually runs on.
   */
  app.get("/api/clinic/expenses/profit-loss", async (request, reply) => {
    const auth = requireAdminAuth(request, reply);
    if (!auth) return;

    const { from, to } = request.query as { from?: string; to?: string };
    const { start, end } = dayRange(from, to);

    const [payments, deposits, expenses, outstandingInvoices] = await Promise.all([
      // A payment made FROM an advance is not new money: the advance was
      // counted when it was taken. Counting both would earn it twice.
      prisma.payment.findMany({
        where: { paidAt: { gte: start, lte: end }, mode: { not: "DEPOSIT" } },
        select: { amount: true, mode: true },
      }),
      prisma.deposit.findMany({
        where: { at: { gte: start, lte: end }, kind: { in: ["ADVANCE", "REFUND"] } },
        select: { amount: true, mode: true, kind: true },
      }),
      prisma.expense.findMany({
        where: { paidAt: { gte: start, lte: end } },
        select: { amount: true, category: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { items: { select: { amount: true, quantity: true } }, payments: { select: { amount: true } } },
      }),
    ]);

    // Cash basis, the same as the day close: bill payments, plus advances
    // taken, less advances refunded.
    const signed = (d: { amount: unknown; kind: string }) => (d.kind === "REFUND" ? -Number(d.amount) : Number(d.amount));
    const revenue =
      payments.reduce((sum, p) => sum + Number(p.amount), 0) + deposits.reduce((sum, d) => sum + signed(d), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const revenueByMode = new Map<string, number>();
    for (const p of payments) revenueByMode.set(p.mode, (revenueByMode.get(p.mode) ?? 0) + Number(p.amount));
    for (const d of deposits) if (d.mode) revenueByMode.set(d.mode, (revenueByMode.get(d.mode) ?? 0) + signed(d));

    const expenseByCategory = new Map<string, number>();
    for (const e of expenses) {
      expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + Number(e.amount));
    }

    // Money billed in this period but not yet collected. Shown separately
    // from revenue, never folded into it.
    // The same arithmetic as every other screen, so an approved discount is
    // not reported here as money still owed.
    const outstanding = outstandingInvoices.reduce((sum, inv) => sum + summarize(inv.items, inv.payments, inv).balance, 0);

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      revenue,
      expenses: expenseTotal,
      netProfit: revenue - expenseTotal,
      outstanding,
      revenueByMode: [...revenueByMode.entries()].map(([mode, amount]) => ({ mode, amount })),
      expenseByCategory: [...expenseByCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  });
}
