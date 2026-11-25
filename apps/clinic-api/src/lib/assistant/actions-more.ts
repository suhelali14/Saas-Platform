/**
 * The rest of the clinic's day, as things the assistant can be asked for.
 *
 * actions.ts holds what a doctor asks about one patient. This file holds
 * the work around it: moving a visit along the queue, taking money,
 * booking requests from the website, lab results coming back, the
 * pharmacy's shelf, the clinic's own spending and its numbers.
 *
 * The rules are the ones in actions.ts and they are not relaxed here:
 * a READ asks the database or the app's own route and shapes the answer;
 * a WRITE describes itself on a card first and is then made through the
 * app's own route, as the person who asked, so that route's role check,
 * validation and audit entry apply.
 */

import { z } from "zod";
import { prisma } from "../prisma.js";
import { summarize } from "../../routes/clinic-billing.js";
import { nameFit } from "./names.js";
import { sorry, strictObject, type Action, type ActionContext, type Asker, type Line, type Reply } from "./registry.js";
import type { RunContext } from "./actions.js";

const anyone = () => true;
const roles = (...allowed: string[]) => (asker: Asker) => allowed.includes(asker.role);
const admin = (asker: Asker) => asker.isAdmin || asker.role === "ADMIN";

const str = { type: "string" } as const;
const optionalString = { type: ["string", "null"] } as const;
const optionalNumber = { type: ["number", "null"] } as const;
const NONE = z.object({});
const NO_PARAMS = strictObject({});

const BILLING = ["RECEPTIONIST", "DOCTOR", "ADMIN", "CASHIER", "BILLING_CLERK"];
const FRONT_DESK = ["RECEPTIONIST", "DOCTOR", "ADMIN"];
const PHARMACY = ["PHARMACIST", "DOCTOR", "ADMIN"];
const LAB_RESULTS = ["RECEPTIONIST", "NURSE", "DOCTOR", "ADMIN", "LAB_TECH"];
const LEDGER = ["RECEPTIONIST", "DOCTOR", "ADMIN"];

const NO_PATIENT = sorry("Open a patient's file or visit first, or tell me who you mean.");
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function boundsOf(iso: string): { start: Date; end: Date } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { start: new Date(y, m - 1, d, 0, 0, 0, 0), end: new Date(y, m - 1, d, 23, 59, 59, 999) };
}
function day(d: Date | string): string {
  // "Thu 26 Nov 2026". Put together by hand: the locale's own version
  // scatters commas through it.
  const x = new Date(d);
  return `${x.toLocaleDateString("en-IN", { weekday: "short" })} ${x.getDate()} ${x.toLocaleDateString("en-IN", { month: "short" })} ${x.getFullYear()}`;
}
function clock(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}
function refusal(result: { status: number; body: any }, fallback: string): Reply {
  const said = typeof result.body?.error === "string" ? result.body.error : null;
  return sorry(said ?? fallback);
}
async function nameOf(patientId: string | null): Promise<string | null> {
  if (!patientId) return null;
  return (await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true } }))?.name ?? null;
}

/** The visit a request is about: the one on screen, or the patient's
 *  visit today that is not over. */
async function visitFor(context: ActionContext) {
  const select = { id: true, status: true, tokenNumber: true, scheduledAt: true, patientId: true, patient: { select: { name: true } } } as const;
  if (context.appointmentId) return prisma.appointment.findUnique({ where: { id: context.appointmentId }, select });
  if (!context.patientId) return null;
  const { start, end } = boundsOf(isoOf(context.today));
  const todays = await prisma.appointment.findMany({ where: { patientId: context.patientId, scheduledAt: { gte: start, lte: end } }, select, orderBy: { scheduledAt: "desc" } });
  return todays.find((v) => v.status === "IN_PROGRESS") ?? todays.find((v) => v.status === "CHECKED_IN") ?? todays.find((v) => v.status === "SCHEDULED") ?? todays[0] ?? null;
}

/** A stretch of days somebody named: "today", "this week", "last month". */
const PERIODS = ["today", "yesterday", "this_week", "this_month", "last_month", "last_30_days"] as const;
type Period = (typeof PERIODS)[number];
function rangeOf(period: Period | null | undefined, today: Date): { from: string; to: string; label: string } {
  const d = (offset: number) => { const x = new Date(today); x.setDate(x.getDate() + offset); return x; };
  switch (period) {
    case "today": return { from: isoOf(today), to: isoOf(today), label: "today" };
    case "yesterday": return { from: isoOf(d(-1)), to: isoOf(d(-1)), label: "yesterday" };
    case "this_week": return { from: isoOf(d(-((today.getDay() + 6) % 7))), to: isoOf(today), label: "this week" };
    case "last_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoOf(first), to: isoOf(last), label: first.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
    }
    case "last_30_days": return { from: isoOf(d(-29)), to: isoOf(today), label: "the last 30 days" };
    default: return { from: isoOf(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoOf(today), label: "this month" };
  }
}
const periodParam = { type: ["string", "null"], enum: [...PERIODS, null], description: "The stretch of days they asked about. Leave out for this month." };

// ── The queue ─────────────────────────────────────────────────────────

const STATUS = {
  arrived: { to: "CHECKED_IN", title: "as arrived", done: "is marked as arrived" },
  start: { to: "IN_PROGRESS", title: "as with the doctor", done: "is with the doctor now" },
  done: { to: "COMPLETED", title: "as seen", done: "is marked as seen" },
  cancel: { to: "CANCELLED", title: "as cancelled", done: "is cancelled" },
  no_show: { to: "NO_SHOW", title: "as not having come", done: "is marked as a no-show" },
} as const;
type StatusWord = keyof typeof STATUS;

const setVisitStatus: Action = {
  name: "set_visit_status",
  summary: "Moves a patient's visit along the queue: marks them as arrived (check in a booked patient), with the doctor (call in, start the consultation), seen (visit done, finished, completed), cancelled, or a no-show (did not come). For the patient on screen, or one named in for_patient.",
  kind: "write",
  needsPatient: true,
  schema: z.object({ status: z.enum(["arrived", "start", "done", "cancel", "no_show"]) }),
  jsonSchema: strictObject({ status: { ...str, enum: ["arrived", "start", "done", "cancel", "no_show"] } }),
  allowed: anyone,
  async preview(context, params: { status: StatusWord }) {
    const visit = await visitFor(context);
    if (!visit) return sorry(`${(await nameOf(context.patientId)) ?? "This patient"} has no visit today. Say “add to queue” to check them in.`);
    const want = STATUS[params.status];
    if (visit.status === want.to) return sorry(`${visit.patient.name}'s visit is already marked ${want.title.replace(/^as /, "")}.`);
    return {
      kind: "confirm", action: "set_visit_status", params,
      title: `Mark ${visit.patient.name}'s visit ${want.title}?`,
      lines: [{ label: "Visit", text: `${day(visit.scheduledAt)}${visit.tokenNumber != null ? ` · token ${visit.tokenNumber}` : ""}` }],
    };
  },
  async run(context: RunContext, params: { status: StatusWord }) {
    const visit = await visitFor(context);
    if (!visit) return sorry("That patient has no visit today.");
    const res = await context.call("PATCH", `/api/clinic/appointments/${visit.id}`, { status: STATUS[params.status].to });
    if (res.status !== 200) return refusal(res, "The visit could not be changed.");
    return { kind: "done", say: `${visit.patient.name} ${STATUS[params.status].done}${res.body?.tokenNumber != null && params.status === "arrived" ? `, token ${res.body.tokenNumber}` : ""}.`, to: params.status === "start" ? `/appointments/${visit.id}/encounter` : undefined };
  },
};

const bookingsOnDate: Action = {
  name: "bookings_on_date",
  summary: "Lists who is booked on a given day (tomorrow, Monday, 3 December): how many, and each patient with their time. Use it for 'who is coming tomorrow', 'how many appointments on Friday', 'kal kitne patient hain'.",
  kind: "read",
  schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  jsonSchema: strictObject({ date: { ...str, description: "The day, as YYYY-MM-DD." } }),
  allowed: anyone,
  async run(_context, params: { date: string }) {
    const { start, end } = boundsOf(params.date);
    const visits = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      select: { id: true, scheduledAt: true, status: true, reason: true, patient: { select: { id: true, name: true } }, doctor: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 60,
    });
    if (visits.length === 0) return { kind: "answer", title: `Nobody is booked on ${day(start)}`, lines: [{ text: "The day is clear.", tone: "muted" }], to: "/queue", toLabel: "Open the queue" };
    return {
      kind: "answer",
      title: `${visits.length} booked on ${day(start)}`,
      lines: visits.slice(0, 25).map((v) => ({ label: clock(v.scheduledAt), text: [v.patient.name, v.doctor?.name ? `Dr. ${v.doctor.name.replace(/^Dr\.?\s*/i, "")}` : null, v.reason].filter(Boolean).join(" · "), to: `/patients/${v.patient.id}` })),
      to: "/queue",
      toLabel: "Open the queue",
    };
  },
};

// ── Money ─────────────────────────────────────────────────────────────

/** The bill a request is about: the visit's, or the patient's latest unpaid. */
async function billFor(context: ActionContext) {
  const include = { items: true, payments: true } as const;
  if (context.appointmentId) {
    const bill = await prisma.invoice.findFirst({ where: { appointmentId: context.appointmentId }, include, orderBy: { createdAt: "desc" } });
    if (bill) return bill;
  }
  if (!context.patientId) return null;
  const bills = await prisma.invoice.findMany({ where: { patientId: context.patientId }, include, orderBy: { createdAt: "desc" }, take: 20 });
  return bills.find((b) => summarize(b.items, b.payments, b).balance > 0) ?? (context.appointmentId ? null : bills[0] ?? null);
}

const visitBill: Action = {
  name: "visit_bill",
  summary: "Shows the patient's bill: each charge on it, what has been paid and what is still to pay. Use it for 'show the bill', 'what are the charges', 'bill kitna hua'.",
  kind: "read",
  needsPatient: true,
  module: "billing",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: roles(...BILLING),
  async run(context) {
    if (!context.patientId) return NO_PATIENT;
    const who = (await nameOf(context.patientId)) ?? "This patient";
    const bill = await billFor(context);
    if (!bill) return { kind: "answer", title: `${who} has no bill yet`, lines: [{ text: "No charge has been added for this visit.", tone: "muted" }], to: "/billing", toLabel: "Open billing" };
    const sum = summarize(bill.items, bill.payments, bill);
    return {
      kind: "answer",
      title: `${who}'s bill: ${rupees(sum.total)}`,
      lines: [
        ...bill.items.map((i): Line => ({ label: i.quantity > 1 ? `${i.quantity} ×` : undefined, text: `${i.description} · ${rupees(Number(i.amount) * i.quantity)}` })),
        { label: "Paid", text: rupees(sum.paid), tone: "muted" },
        { label: "To pay", text: rupees(sum.balance), tone: sum.balance > 0 ? "warning" : "muted" },
      ],
      to: "/billing",
      toLabel: "Open billing",
    };
  },
};

const MODES = { cash: "CASH", upi: "UPI", card: "CARD" } as const;

const takePayment: Action = {
  name: "take_payment",
  summary: "Records money received from the patient against their bill: 'took 500 cash', 'paid by UPI', 'payment le liya', 'full payment received in cash'. Needs how it was paid (cash, UPI or card); if that was not said, ask. Leave the amount out when they paid the whole balance.",
  kind: "write",
  needsPatient: true,
  module: "billing",
  schema: z.object({ amount: z.number().positive().max(10_000_000).nullable().optional(), mode: z.enum(["cash", "upi", "card"]) }),
  jsonSchema: strictObject({ amount: { ...optionalNumber, description: "Rupees received. Leave out for the whole balance." }, mode: { ...str, enum: ["cash", "upi", "card"] } }),
  allowed: roles(...BILLING),
  async preview(context, params: { amount?: number | null; mode: keyof typeof MODES }) {
    if (!context.patientId) return NO_PATIENT;
    const who = (await nameOf(context.patientId)) ?? "this patient";
    const bill = await billFor(context);
    if (!bill) {
      // Opening a visit's bill for the first time puts the clinic's
      // consultation fee on it. That is what Confirm will do here.
      const clinic = await prisma.clinic.findFirst({ select: { defaultConsultationFee: true } });
      const fee = Number(clinic?.defaultConsultationFee ?? 0);
      if (!context.appointmentId || fee <= 0) return sorry(`${who} has no bill yet. Add a charge first: “add consultation charge”.`);
      const amount = params.amount ?? fee;
      if (amount > fee) return sorry(`The consultation fee is ${rupees(fee)}. Add the other charges first, then take the payment.`);
      return { kind: "confirm", action: "take_payment", params: { ...params, amount }, title: `Take ${rupees(amount)} from ${who} by ${params.mode === "upi" ? "UPI" : params.mode}?`, lines: [{ label: "Bill", text: `Consultation fee · ${rupees(fee)}, raised now` }, { label: "Left to pay", text: rupees(fee - amount) }] };
    }
    const sum = summarize(bill.items, bill.payments, bill);
    if (sum.balance <= 0) return sorry(`${who}'s bill is already paid in full.`);
    const amount = params.amount ?? sum.balance;
    if (amount > sum.balance + 0.01) return sorry(`Only ${rupees(sum.balance)} is left to pay on ${who}'s bill.`);
    return {
      kind: "confirm", action: "take_payment", params: { ...params, amount },
      title: `Take ${rupees(amount)} from ${who} by ${params.mode === "upi" ? "UPI" : params.mode}?`,
      lines: [{ label: "Bill", text: `${rupees(sum.total)}, of which ${rupees(sum.paid)} is paid` }, { label: "Left to pay", text: rupees(sum.balance - amount), tone: sum.balance - amount > 0 ? "warning" : "muted" }],
    };
  },
  async run(context: RunContext, params: { amount?: number | null; mode: keyof typeof MODES }) {
    let billId = (await billFor(context))?.id ?? null;
    if (!billId && context.appointmentId) {
      const opened = await context.call("GET", `/api/clinic/appointments/${context.appointmentId}/invoice`);
      if (opened.status >= 400 || !opened.body?.id) return refusal(opened, "The visit's bill could not be opened.");
      billId = opened.body.id;
    }
    if (!billId || params.amount == null) return sorry("There is no bill to take that payment against.");
    const res = await context.call("POST", `/api/clinic/invoices/${billId}/payments`, { amount: params.amount, mode: MODES[params.mode] });
    if (res.status >= 400) return refusal(res, "The payment could not be recorded.");
    const left = Number(res.body?.balance ?? 0);
    return { kind: "done", say: `${rupees(params.amount)} received by ${params.mode === "upi" ? "UPI" : params.mode}. ${left > 0 ? `${rupees(left)} still to pay.` : "The bill is paid in full."}` };
  },
};

const EXPENSE_CATEGORIES = ["Rent", "Salaries", "Electricity", "Water", "Medical Supplies", "Pharmacy Stock", "Equipment", "Maintenance", "Lab Charges", "Marketing", "Insurance", "Taxes & Licences", "Other"] as const;

const addExpense: Action = {
  name: "add_expense",
  summary: "Records money the clinic spent: 'paid 1200 for electricity', 'bijli ka bill 1200 bhara', 'bought gloves for 450 by UPI'. Needs the amount and what it was for.",
  kind: "write",
  module: "expenses",
  schema: z.object({
    amount: z.number().positive().max(10_000_000),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(1).max(300),
    mode: z.enum(["cash", "upi", "card"]).nullable().optional(),
    vendor: z.string().max(200).nullable().optional(),
  }),
  jsonSchema: strictObject({
    amount: { type: "number", description: "Rupees spent." },
    category: { ...str, enum: [...EXPENSE_CATEGORIES], description: "The closest of these. 'Other' when none fits." },
    description: { ...str, description: "What it was for, in a few words." },
    mode: { type: ["string", "null"], enum: ["cash", "upi", "card", null], description: "How it was paid. Leave out for cash." },
    vendor: { ...optionalString, description: "Who was paid, if they said." },
  }),
  allowed: roles(...LEDGER),
  async preview(_context, params: { amount: number; category: string; description: string; mode?: keyof typeof MODES | null; vendor?: string | null }) {
    return {
      kind: "confirm", action: "add_expense", params,
      title: `Record ${rupees(params.amount)} spent on ${params.description}?`,
      lines: [{ label: "Under", text: params.category }, { label: "Paid by", text: params.mode === "upi" ? "UPI" : params.mode ?? "cash" }, ...(params.vendor ? [{ label: "Paid to", text: params.vendor }] : []), { label: "Dated", text: "today", tone: "muted" as const }],
    };
  },
  async run(context: RunContext, params: { amount: number; category: string; description: string; mode?: keyof typeof MODES | null; vendor?: string | null }) {
    const res = await context.call("POST", "/api/clinic/expenses", { category: params.category, description: params.description, amount: params.amount, paidAt: isoOf(context.today), paymentMode: MODES[params.mode ?? "cash"], ...(params.vendor ? { vendor: params.vendor } : {}) });
    if (res.status >= 400) return refusal(res, "The expense could not be recorded.");
    return { kind: "done", say: `${rupees(params.amount)} recorded under ${params.category}.`, to: "/expenses" };
  },
};

const profitAndLoss: Action = {
  name: "profit_and_loss",
  summary: "Says what the clinic earned, what it spent and what is left over a stretch of days: 'profit this month', 'how much did we earn last month', 'is mahine ka kharcha'. For the clinic's admin.",
  kind: "read",
  module: "expenses",
  schema: z.object({ period: z.enum(PERIODS).nullable().optional() }),
  jsonSchema: strictObject({ period: periodParam }),
  allowed: admin,
  async run(context: RunContext, params: { period?: Period | null }) {
    const range = rangeOf(params.period, context.today);
    const res = await context.call("GET", `/api/clinic/expenses/profit-loss?from=${range.from}&to=${range.to}`);
    if (res.status !== 200) return refusal(res, "The figures could not be read just now.");
    const b = res.body as { revenue: number; expenses: number; netProfit: number; outstanding: number; expenseByCategory: { category: string; amount: number }[] };
    return {
      kind: "answer",
      title: b.netProfit >= 0 ? `${rupees(b.netProfit)} left over ${range.label}` : `${rupees(-b.netProfit)} more spent than received ${range.label}`,
      lines: [
        { label: "Received", text: rupees(b.revenue) },
        { label: "Spent", text: rupees(b.expenses) },
        ...b.expenseByCategory.slice(0, 4).map((e): Line => ({ label: "", text: `${e.category} · ${rupees(e.amount)}`, tone: "muted" })),
        { label: "Still owed", text: rupees(b.outstanding), tone: b.outstanding > 0 ? "warning" : "muted" },
      ],
      to: "/expenses",
      toLabel: "Open expenses",
    };
  },
};

// ── Requests from the website ─────────────────────────────────────────

async function newRequests() {
  return prisma.appointmentRequest.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "asc" }, take: 50 });
}

const bookingRequests: Action = {
  name: "booking_requests",
  summary: "Lists the appointment requests people sent from the clinic's website that nobody has answered yet.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: roles(...FRONT_DESK),
  async run() {
    const waiting = await newRequests();
    if (waiting.length === 0) return { kind: "answer", title: "No booking requests are waiting", lines: [{ text: "Every request from the website has been answered.", tone: "muted" }], to: "/requests", toLabel: "Open booking requests" };
    return {
      kind: "answer",
      title: `${waiting.length} booking request${waiting.length === 1 ? "" : "s"} waiting`,
      lines: waiting.slice(0, 12).map((r) => ({ label: r.preferredDate ? day(r.preferredDate).replace(/ \d{4}$/, "") : "Any day", text: [r.name, r.phone, r.preferredSlot, r.reason].filter(Boolean).join(" · "), to: "/requests" })),
      to: "/requests",
      toLabel: "Open booking requests",
    };
  },
};

const answerBookingRequest: Action = {
  name: "answer_booking_request",
  summary: "Answers one appointment request from the website, by the name of the person who asked: declines it, or confirms it for a day and time. To confirm you need the day; ask if it was not said.",
  kind: "write",
  schema: z.object({
    name: z.string().trim().min(2).max(120),
    decision: z.enum(["confirm", "decline"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    time: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    requestId: z.string().optional(),
  }),
  jsonSchema: strictObject({
    name: { ...str, description: "Who asked for the appointment, as it was said." },
    decision: { ...str, enum: ["confirm", "decline"] },
    date: { ...optionalString, description: "For a confirmation: the day, YYYY-MM-DD." },
    time: { ...optionalString, description: "For a confirmation: the time as 24-hour HH:MM, if said." },
    note: optionalString,
  }),
  allowed: roles(...FRONT_DESK),
  async preview(_context, params: { name: string; decision: "confirm" | "decline"; date?: string | null; time?: string | null; note?: string | null }) {
    const waiting = await newRequests();
    const fits = waiting.map((r) => ({ r, fit: nameFit(params.name, r.name) })).filter((x) => x.fit >= 0.6).sort((a, b) => b.fit - a.fit);
    if (fits.length === 0) return sorry(`No waiting request is from anyone called "${params.name}".`);
    if (fits.length > 1 && fits[0]!.fit === fits[1]!.fit) return { kind: "answer", title: `${fits.length} requests are from a "${params.name}". Answer it on the screen.`, lines: fits.map(({ r }) => ({ text: [r.name, r.phone, r.reason].filter(Boolean).join(" · "), to: "/requests" })), to: "/requests", toLabel: "Open booking requests" };
    const request = fits[0]!.r;
    const asked = [request.preferredDate ? day(request.preferredDate) : "any day", request.preferredSlot].filter(Boolean).join(", ");
    if (params.decision === "decline") {
      return { kind: "confirm", action: "answer_booking_request", params: { ...params, requestId: request.id }, title: `Decline ${request.name}'s request?`, lines: [{ label: "Asked for", text: asked }, { label: "Phone", text: request.phone }, ...(params.note ? [{ label: "Note", text: params.note }] : [])] };
    }
    const date = params.date ?? (request.preferredDate ? isoOf(request.preferredDate) : null);
    if (!date) return sorry("Which day should I book them for?");
    const time = params.time ?? (request.preferredSlot === "evening" ? "17:00" : request.preferredSlot === "afternoon" ? "13:00" : "10:00");
    return {
      kind: "confirm", action: "answer_booking_request", params: { ...params, date, time, requestId: request.id },
      title: `Book ${request.name} for ${day(boundsOf(date).start)} at ${time}?`,
      lines: [{ label: "Asked for", text: asked }, { label: "Phone", text: request.phone }, ...(request.reason ? [{ label: "For", text: request.reason }] : []), { text: "If they are not on file yet, they are registered as a new patient.", tone: "muted" }],
    };
  },
  async run(context: RunContext, params: { name: string; decision: "confirm" | "decline"; date?: string | null; time?: string | null; note?: string | null; requestId?: string }) {
    if (!params.requestId) return sorry("Ask me again and I will find the request.");
    if (params.decision === "decline") {
      const res = await context.call("POST", `/api/clinic/appointment-requests/${params.requestId}/decline`, params.note ? { note: params.note } : {});
      if (res.status >= 400) return refusal(res, "The request could not be declined.");
      return { kind: "done", say: `${params.name}'s request is declined.`, to: "/requests" };
    }
    if (!params.date) return sorry("Which day should I book them for?");
    const [h, m] = (params.time ?? "10:00").split(":").map(Number) as [number, number];
    const when = boundsOf(params.date).start;
    when.setHours(h, m, 0, 0);
    const res = await context.call("POST", `/api/clinic/appointment-requests/${params.requestId}/confirm`, { scheduledAt: when.toISOString(), ...(params.note ? { note: params.note } : {}) });
    // The app stops here when somebody already on file looks like the
    // same person. That is for a person to decide, looking at both.
    if (res.status >= 400) return { kind: "done", say: `${typeof res.body?.error === "string" ? res.body.error : "This one needs a look before it is booked"} Open the request to finish it.`, to: "/requests" };
    return { kind: "done", say: `${params.name} is booked for ${day(when)} at ${clock(when)}.`, to: "/requests" };
  },
};

// ── The lab ───────────────────────────────────────────────────────────

const pendingLabResults: Action = {
  name: "pending_lab_results",
  summary: "Lists the lab tests that were ordered and whose results have not come back yet, across the clinic. Use it for 'which reports are pending', 'kaunse report baki hain'.",
  kind: "read",
  module: "labs",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run() {
    const items = await prisma.labOrderItem.findMany({
      where: { completedAt: null, labOrder: { status: { not: "CANCELLED" as never } } },
      select: { testName: true, labOrder: { select: { createdAt: true, patient: { select: { id: true, name: true } } } } },
      orderBy: { labOrder: { createdAt: "asc" } },
      take: 40,
    }).catch(() => prisma.labOrderItem.findMany({ where: { completedAt: null }, select: { testName: true, labOrder: { select: { createdAt: true, patient: { select: { id: true, name: true } } } } }, take: 40 }));
    if (items.length === 0) return { kind: "answer", title: "No lab results are awaited", lines: [{ text: "Every test ordered has its result.", tone: "muted" }], to: "/labs", toLabel: "Open lab orders" };
    return {
      kind: "answer",
      title: `${items.length === 40 ? "40 or more" : items.length} lab result${items.length === 1 ? "" : "s"} awaited`,
      lines: items.slice(0, 15).map((i) => ({ label: day(i.labOrder.createdAt).replace(/ \d{4}$/, ""), text: `${i.testName} · ${i.labOrder.patient.name}`, to: `/patients/${i.labOrder.patient.id}` })),
      to: "/labs",
      toLabel: "Open lab orders",
    };
  },
};

const enterLabResult: Action = {
  name: "enter_lab_result",
  summary: "Writes in the result of a lab test that was ordered for the patient and has come back: 'HbA1c is 7.2', 'haemoglobin 11.4 aaya hai', 'enter CBC result: Hb 12, WBC 8000'. Needs which test and the result.",
  kind: "write",
  needsPatient: true,
  module: "labs",
  schema: z.object({ test: z.string().trim().min(2).max(120), result: z.string().trim().min(1).max(2000), itemId: z.string().optional() }),
  jsonSchema: strictObject({ test: { ...str, description: "The test, as it was said." }, result: { ...str, description: "The result exactly as said, with its unit if one was given." } }),
  allowed: roles(...LAB_RESULTS),
  async preview(context, params: { test: string; result: string }) {
    if (!context.patientId) return NO_PATIENT;
    const who = (await nameOf(context.patientId)) ?? "this patient";
    const awaited = await prisma.labOrderItem.findMany({ where: { completedAt: null, labOrder: { patientId: context.patientId } }, select: { id: true, testName: true, labOrder: { select: { createdAt: true } } }, orderBy: { labOrder: { createdAt: "desc" } } });
    if (awaited.length === 0) return sorry(`No test is awaiting a result for ${who}. Order the test first.`);
    // "Urine report" is "Urine Routine & Microscopy"; "sugar fasting" is
    // "Fasting Blood Sugar". The words that name the test must all be in
    // the test's name; the words every test has are not among them.
    const key = params.test.toLowerCase().replace(/[^a-z0-9]/g, "");
    const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const naming = params.test.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !["report", "reports", "test", "tests", "result", "results", "level", "levels", "the", "ka", "ki", "of"].includes(w));
    const byWords = naming.length > 0 ? awaited.filter((i) => naming.every((w) => i.testName.toLowerCase().includes(w))) : [];
    const oneTest = new Set(byWords.map((i) => i.testName)).size === 1 ? byWords[0] : undefined;
    const item = awaited.find((i) => squash(i.testName) === key) ?? awaited.find((i) => squash(i.testName).includes(key) || key.includes(squash(i.testName))) ?? oneTest;
    if (!item) return { kind: "answer", title: `${who} has no "${params.test}" awaiting a result. These are awaited:`, lines: awaited.map((i) => ({ text: i.testName })) };
    return { kind: "confirm", action: "enter_lab_result", params: { ...params, itemId: item.id }, title: `Enter this result for ${who}?`, lines: [{ label: "Test", text: item.testName }, { label: "Result", text: params.result }, { label: "Ordered", text: day(item.labOrder.createdAt), tone: "muted" }] };
  },
  async run(context: RunContext, params: { test: string; result: string; itemId?: string }) {
    if (!params.itemId) return sorry("Ask me again and I will find the test.");
    const item = await prisma.labOrderItem.findUnique({ where: { id: params.itemId }, select: { labOrder: { select: { patientId: true } } } });
    if (!item || item.labOrder.patientId !== context.patientId) return sorry("That test is not this patient's.");
    const res = await context.call("PATCH", `/api/clinic/lab-orders/items/${params.itemId}`, { resultText: params.result });
    if (res.status >= 400) return refusal(res, "The result could not be saved.");
    return { kind: "done", say: `${params.test} result saved: ${params.result}.`, to: context.patientId ? `/patients/${context.patientId}` : "/labs" };
  },
};

// ── The pharmacy ──────────────────────────────────────────────────────

const stockAlerts: Action = {
  name: "stock_alerts",
  summary: "Says which medicines are running low, which batches have expired and which expire soon. Use it for 'what is low in stock', 'what needs reordering', 'kaunsi dawai khatam ho rahi hai', 'anything expiring'.",
  kind: "read",
  module: "pharmacy",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context: RunContext) {
    const res = await context.call("GET", "/api/clinic/inventory/alerts");
    if (res.status !== 200) return refusal(res, "The stock could not be read just now.");
    type Batch = { drug?: { name?: string }; quantityInHand: number; expiryDate: string; batchNumber?: string };
    const { expired = [], nearExpiry = [], lowStock = [] } = res.body as { expired: Batch[]; nearExpiry: Batch[]; lowStock: Batch[] };
    if (expired.length + nearExpiry.length + lowStock.length === 0) return { kind: "answer", title: "The shelf is in order", lines: [{ text: "Nothing is low, expired or about to expire.", tone: "muted" }], to: "/pharmacy", toLabel: "Open pharmacy" };
    const name = (b: Batch) => b.drug?.name ?? "A medicine";
    return {
      kind: "answer",
      title: `${lowStock.length} low, ${expired.length} expired, ${nearExpiry.length} expiring soon`,
      lines: [
        ...lowStock.slice(0, 8).map((b): Line => ({ label: "Low", text: `${name(b)} · ${b.quantityInHand} left`, tone: "warning" })),
        ...expired.slice(0, 5).map((b): Line => ({ label: "Expired", text: `${name(b)} · ${b.quantityInHand} units · ${day(b.expiryDate)}`, tone: "danger" })),
        ...nearExpiry.slice(0, 5).map((b): Line => ({ label: "Expiring", text: `${name(b)} · ${b.quantityInHand} units · ${day(b.expiryDate)}` })),
      ],
      to: "/pharmacy",
      toLabel: "Open pharmacy",
    };
  },
};

const medicineStock: Action = {
  name: "medicine_stock",
  summary: "Says how much of one medicine the clinic's pharmacy has in hand and when it expires: 'do we have Dolo 650', 'Pan 40 kitna hai', 'stock of amoxicillin'.",
  kind: "read",
  module: "pharmacy",
  schema: z.object({ medicine: z.string().trim().min(2).max(120) }),
  jsonSchema: strictObject({ medicine: { ...str, description: "The medicine as it was said." } }),
  allowed: anyone,
  async run(_context, params: { medicine: string }) {
    const words = params.medicine.split(/\s+/).filter((w) => w.length > 1);
    const batches = await prisma.drugBatch.findMany({
      where: { quantityInHand: { gt: 0 }, drug: { AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) } },
      select: { quantityInHand: true, expiryDate: true, drug: { select: { id: true, name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 200,
    });
    if (batches.length === 0) return { kind: "answer", title: `No "${params.medicine}" in stock`, lines: [{ text: "Nothing by that name is on the shelf.", tone: "warning" }], to: "/pharmacy", toLabel: "Open pharmacy" };
    const byDrug = new Map<string, { name: string; total: number; soonest: Date }>();
    for (const b of batches) {
      const row = byDrug.get(b.drug.id) ?? { name: b.drug.name, total: 0, soonest: b.expiryDate };
      row.total += b.quantityInHand;
      byDrug.set(b.drug.id, row);
    }
    const rows = [...byDrug.values()].slice(0, 8);
    return { kind: "answer", title: rows.length === 1 ? `${rows[0]!.name}: ${rows[0]!.total} in stock` : `${rows.length} medicines match "${params.medicine}"`, lines: rows.map((r) => ({ label: `${r.total} left`, text: `${r.name} · earliest expiry ${day(r.soonest)}`, tone: r.soonest < new Date() ? "danger" as const : undefined })), to: "/pharmacy", toLabel: "Open pharmacy" };
  },
};

const dispensePrescription: Action = {
  name: "dispense_prescription",
  summary: "Marks the patient's latest prescription as given out by the pharmacy, and takes the medicines off the stock. Use it for 'dispense', 'medicines given', 'dawai de di'.",
  kind: "write",
  needsPatient: true,
  module: "pharmacy",
  schema: z.object({ prescriptionId: z.string().optional() }),
  jsonSchema: NO_PARAMS,
  allowed: roles(...PHARMACY),
  async preview(context) {
    if (!context.patientId) return NO_PATIENT;
    const who = (await nameOf(context.patientId)) ?? "this patient";
    const rx = await prisma.prescription.findFirst({ where: { patientId: context.patientId, dispensed: false }, include: { items: true }, orderBy: { createdAt: "desc" } });
    if (!rx) return sorry(`${who} has no prescription waiting to be given out.`);
    return { kind: "confirm", action: "dispense_prescription", params: { prescriptionId: rx.id }, title: `Give out ${who}'s prescription of ${day(rx.createdAt)}?`, lines: [...rx.items.map((m): Line => ({ text: [m.drugName, m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ") })), { text: "The medicines are taken off the stock.", tone: "muted" }] };
  },
  async run(context: RunContext, params: { prescriptionId?: string }) {
    if (!params.prescriptionId) return sorry("Ask me again and I will find the prescription.");
    const rx = await prisma.prescription.findUnique({ where: { id: params.prescriptionId }, select: { patientId: true, dispensed: true } });
    if (!rx || rx.patientId !== context.patientId) return sorry("That prescription is not this patient's.");
    if (rx.dispensed) return sorry("That prescription has already been given out.");
    const res = await context.call("PATCH", `/api/clinic/prescriptions/${params.prescriptionId}/dispense`, {});
    if (res.status >= 400) return refusal(res, "The prescription could not be marked as given out.");
    const short = (res.body?.stockWarnings ?? []) as string[];
    return { kind: "done", say: `Marked as given out.${short.length > 0 ? ` Short on the shelf: ${short.join("; ")}.` : ""}`, to: "/pharmacy" };
  },
};

// ── The patient's own details, and the note ───────────────────────────

/** Adds to a list kept as text ("Penicillin, Sulfa") without repeating. */
function withAdded(existing: string | null, more: string): string {
  const have = (existing ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const item of more.split(/[,;]+| and /i).map((s) => s.trim()).filter(Boolean)) {
    if (!have.some((h) => h.toLowerCase() === item.toLowerCase())) have.push(item);
  }
  return have.join(", ");
}

const UPDATE_FIELDS = z.object({
  name: z.string().trim().min(2).max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bloodGroup: z.string().max(10).nullable().optional(),
  addAllergy: z.string().max(300).nullable().optional(),
  addCondition: z.string().max(300).nullable().optional(),
  deskNote: z.string().max(1000).nullable().optional(),
  emergencyContactName: z.string().max(200).nullable().optional(),
  emergencyContactPhone: z.string().max(30).nullable().optional(),
});
type UpdateFields = z.infer<typeof UPDATE_FIELDS>;

async function patientChanges(context: ActionContext, params: UpdateFields) {
  const patient = await prisma.patient.findUnique({ where: { id: context.patientId! }, select: { name: true, phone: true, age: true, gender: true, address: true, bloodGroup: true, allergies: true, chronicConditions: true, deskNote: true, emergencyContactName: true, emergencyContactPhone: true } });
  if (!patient) return null;
  const data: Record<string, string | number> = {};
  const lines: Line[] = [];
  const set = (label: string, key: keyof typeof patient, value: string | number | null | undefined) => {
    if (value == null || value === "" || String(patient[key] ?? "") === String(value)) return;
    data[key] = value;
    lines.push({ label, text: patient[key] ? `${patient[key]} → ${value}` : String(value) });
  };
  set("Name", "name", params.name);
  set("Phone", "phone", params.phone);
  set("Age", "age", params.age);
  set("Sex", "gender", params.gender);
  set("Address", "address", params.address);
  set("Blood group", "bloodGroup", params.bloodGroup?.toUpperCase().replace(/\s+/g, "").replace(/POSITIVE|POS/, "+").replace(/NEGATIVE|NEG/, "-"));
  set("Desk note", "deskNote", params.deskNote);
  set("Emergency contact", "emergencyContactName", params.emergencyContactName);
  set("Their phone", "emergencyContactPhone", params.emergencyContactPhone);
  if (params.addAllergy) set("Allergies", "allergies", withAdded(patient.allergies, params.addAllergy));
  if (params.addCondition) set("Long-term conditions", "chronicConditions", withAdded(patient.chronicConditions, params.addCondition));
  return { patient, data, lines };
}

const updatePatient: Action = {
  name: "update_patient",
  summary: "Changes the patient's own details on their file: the spelling of their name, phone number, age, sex, address, blood group, emergency contact, a note for the front desk; or adds an allergy or a long-term condition (diabetes, hypertension, asthma) to what is already recorded. Use it for 'she is allergic to penicillin', 'his new number is 98…', 'blood group B positive', 'note that he is diabetic'.",
  kind: "write",
  needsPatient: true,
  schema: UPDATE_FIELDS,
  jsonSchema: strictObject({
    name: { ...optionalString, description: "The patient's name, corrected: only when they say the name on file is wrong or misspelt." },
    phone: optionalString, age: optionalNumber, gender: { ...optionalString, description: "Male or Female." }, address: optionalString,
    bloodGroup: { ...optionalString, description: "Such as B+ or O-." },
    addAllergy: { ...optionalString, description: "An allergy to add to those on file." },
    addCondition: { ...optionalString, description: "A long-term condition to add to those on file." },
    deskNote: { ...optionalString, description: "A non-clinical note for whoever meets them at the desk." },
    emergencyContactName: optionalString, emergencyContactPhone: optionalString,
  }),
  allowed: anyone,
  async preview(context, params: UpdateFields) {
    if (!context.patientId) return NO_PATIENT;
    const changes = await patientChanges(context, params);
    if (!changes) return NO_PATIENT;
    if (changes.lines.length === 0) return sorry(`${changes.patient.name}'s file already says that.`);
    return { kind: "confirm", action: "update_patient", params, title: `Change ${changes.patient.name}'s file?`, lines: changes.lines };
  },
  async run(context: RunContext, params: UpdateFields) {
    if (!context.patientId) return NO_PATIENT;
    const changes = await patientChanges(context, params);
    if (!changes || changes.lines.length === 0) return sorry("There was nothing to change.");
    const res = await context.call("PUT", `/api/clinic/patients/${context.patientId}`, changes.data);
    if (res.status >= 400) return refusal(res, "The file could not be changed.");
    return { kind: "done", say: `${changes.patient.name}'s file is updated: ${changes.lines.map((l) => l.label?.toLowerCase()).join(", ")}.`, to: `/patients/${context.patientId}` };
  },
};

const NOTE_FIELDS = z.object({
  chiefComplaint: z.string().max(1000).nullable().optional(),
  history: z.string().max(2000).nullable().optional(),
  diagnosis: z.string().max(1000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
type NoteFields = z.infer<typeof NOTE_FIELDS>;

const writeNote: Action = {
  name: "write_note",
  summary: "Writes the case sheet for the visit that is open, from what the doctor dictates in one go: the complaint, the history, the diagnosis, advice or notes, and a follow-up date. Use it for 'note: fever three days, viral fever, review in five days', 'diagnosis likho acute gastritis'. Saving it finishes the visit. Medicines, tests and vitals have their own tools.",
  kind: "write",
  needsPatient: true,
  schema: NOTE_FIELDS,
  jsonSchema: strictObject({
    chiefComplaint: { ...optionalString, description: "What the patient came with, in short English." },
    history: { ...optionalString, description: "The history of the complaint, if dictated." },
    diagnosis: optionalString,
    notes: { ...optionalString, description: "Findings and advice, if dictated." },
    followUpDate: { ...optionalString, description: "YYYY-MM-DD, when they are to come back, if said." },
  }),
  allowed: roles("DOCTOR"),
  async preview(context, params: NoteFields) {
    if (!context.patientId) return NO_PATIENT;
    if (!context.appointmentId) return sorry("Open the patient's visit first: a note is written on a visit.");
    const who = (await nameOf(context.patientId)) ?? "this patient";
    const lines: Line[] = [
      ...(params.chiefComplaint ? [{ label: "Complaint", text: params.chiefComplaint }] : []),
      ...(params.history ? [{ label: "History", text: params.history }] : []),
      ...(params.diagnosis ? [{ label: "Diagnosis", text: params.diagnosis }] : []),
      ...(params.notes ? [{ label: "Notes", text: params.notes }] : []),
      ...(params.followUpDate ? [{ label: "Follow-up", text: day(boundsOf(params.followUpDate).start) }] : []),
    ];
    if (lines.length === 0) return sorry("What should the note say?");
    return { kind: "confirm", action: "write_note", params, title: `Save this note on ${who}'s visit?`, lines: [...lines, { text: "Saving the note marks the visit as seen.", tone: "muted" }] };
  },
  async run(context: RunContext, params: NoteFields) {
    if (!context.patientId || !context.appointmentId) return sorry("Open the patient's visit first.");
    const followUp = params.followUpDate ? (() => { const d = boundsOf(params.followUpDate!).start; d.setHours(12); return d.toISOString(); })() : undefined;
    const res = await context.call("POST", "/api/clinic/case-sheets", {
      patientId: context.patientId, appointmentId: context.appointmentId,
      ...(params.chiefComplaint ? { chiefComplaint: params.chiefComplaint } : {}), ...(params.history ? { hopi: params.history } : {}),
      ...(params.diagnosis ? { diagnosis: params.diagnosis } : {}), ...(params.notes ? { notes: params.notes } : {}), ...(followUp ? { followUpDate: followUp } : {}),
    });
    if (res.status >= 400) return refusal(res, "The note could not be saved.");
    return { kind: "done", say: `Note saved${params.diagnosis ? `: ${params.diagnosis}` : ""}.`, to: `/appointments/${context.appointmentId}/encounter` };
  },
};

// ── The clinic's numbers and people ───────────────────────────────────

const clinicNumbers: Action = {
  name: "clinic_numbers",
  summary: "Says how busy the clinic has been over a stretch of days: visits, patients seen, how many were new, the commonest diagnoses and each doctor's share. Use it for 'how many patients this month', 'top diagnoses', 'is hafte kitne patient aaye', 'how many new patients last month'.",
  kind: "read",
  module: "analytics",
  schema: z.object({ period: z.enum(PERIODS).nullable().optional() }),
  jsonSchema: strictObject({ period: periodParam }),
  allowed: anyone,
  async run(context: RunContext, params: { period?: Period | null }) {
    const range = rangeOf(params.period, context.today);
    const res = await context.call("GET", `/api/clinic/analytics/overview?from=${range.from}&to=${range.to}`);
    if (res.status !== 200) return refusal(res, "The numbers could not be read just now.");
    const b = res.body as { totals: { totalAppointments: number; uniquePatientsInRange: number; newPatients: number; returningPatients: number }; topDiagnoses?: { diagnosis: string; count: number }[]; doctorWorkload?: { doctorName?: string; name?: string; count: number }[] };
    return {
      kind: "answer",
      title: `${b.totals.totalAppointments} visit${b.totals.totalAppointments === 1 ? "" : "s"} ${range.label}`,
      lines: [
        { label: "Patients", text: `${b.totals.uniquePatientsInRange}, of whom ${b.totals.newPatients} new` },
        ...(b.topDiagnoses ?? []).slice(0, 5).map((d, i): Line => ({ label: i === 0 ? "Commonest" : "", text: `${d.diagnosis} · ${d.count}` })),
        ...(b.doctorWorkload ?? []).slice(0, 5).map((d, i): Line => ({ label: i === 0 ? "By doctor" : "", text: `${d.doctorName ?? d.name ?? "Doctor"} · ${d.count}`, tone: "muted" })),
      ],
      to: "/analytics",
      toLabel: "Open reports",
    };
  },
};

const staffList: Action = {
  name: "staff_list",
  summary: "Lists the people who have a login at this clinic, with their roles. For the clinic's admin.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: admin,
  async run() {
    const staff = await prisma.clinicUser.findMany({ select: { name: true, role: true, isActive: true }, orderBy: { createdAt: "asc" }, take: 60 }).catch(() => null);
    if (!staff) return sorry("The staff list could not be read just now.");
    return { kind: "answer", title: `${staff.length} people have a login`, lines: staff.map((s) => ({ label: s.role.charAt(0) + s.role.slice(1).toLowerCase().replace(/_/g, " "), text: s.name + ((s as { isActive?: boolean }).isActive === false ? " · switched off" : ""), tone: (s as { isActive?: boolean }).isActive === false ? "muted" as const : undefined })), to: "/staff", toLabel: "Open staff" };
  },
};

/**
 * "Start listening." The bar takes one instruction; a whole consultation
 * is listened to from the panel on the visit, where the patient's
 * agreement is ticked. So this takes them to that panel rather than
 * starting anything: the tick is the doctor's to make, in front of the
 * patient, and is never made for them.
 */
const listenToVisit: Action = {
  name: "listen_to_visit",
  summary: "Takes the doctor to where a whole consultation is listened to and written up. Use it when they ask you to start listening, record the consultation, or write the visit from the conversation.",
  kind: "go",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: roles("DOCTOR"),
  async run(context) {
    const visit = await visitFor(context);
    if (!visit) return sorry("Open the patient's visit first. Say “open” and their name, or “call the next patient”.");
    return { kind: "go", to: `/appointments/${visit.id}/encounter#listen`, say: "Here. Tick that the patient agrees, then tap “Listen to the consultation”." };
  },
};

export const MORE_ACTIONS: Action[] = [
  listenToVisit,
  setVisitStatus, bookingsOnDate,
  visitBill, takePayment, addExpense, profitAndLoss,
  bookingRequests, answerBookingRequest,
  pendingLabResults, enterLabResult,
  stockAlerts, medicineStock, dispensePrescription,
  updatePatient, writeNote,
  clinicNumbers, staffList,
];
