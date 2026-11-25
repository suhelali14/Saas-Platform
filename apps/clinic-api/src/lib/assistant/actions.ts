/**
 * Everything the assistant can do in the clinic's app.
 *
 * Each entry is one action (see registry.ts for what that means). To
 * teach the assistant a new thing, add an entry here; the rule router,
 * the model and the screen need no change.
 *
 * ── How an action reaches the app ────────────────────────────────────
 *
 * A READ asks the database directly, through the same queries the
 * screens use, and shapes the answer into a few lines.
 *
 * A WRITE does not touch the database itself. It calls the app's own
 * route for that change, as the person who asked (`context.call`), so
 * the role check, the validation and the audit entry are exactly the
 * ones the screen's Save button gets. There is one place a patient
 * record can be changed from, and the assistant goes through it like
 * everything else.
 */

import { z } from "zod";
import { prisma } from "../prisma.js";
import { isFeatureEnabled, type Feature } from "../../config/features.js";
import { summarize } from "../../routes/clinic-billing.js";
import { byTriage } from "../triage.js";
import { readDuration, readLabTests, readSchedule, type Frequency } from "../scribe/structure.js";
import { resolveMedicine } from "../scribe/engine.js";
import { clinicHost, doctorHabits } from "../scribe/clinic-host.js";
import { checkDraft } from "../scribe/checks.js";
import { SCREENS } from "./router.js";
import { nameFit } from "./names.js";
import { sorry, strictObject, type Action, type ActionContext, type Asker, type Line, type Reply } from "./registry.js";
import { estimatedRupees, usage as meterUsage } from "./meter.js";

/** How a write reaches the app: its own route, as the person asking. */
export type Call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) => Promise<{ status: number; body: any }>;

export interface RunContext extends ActionContext {
  call: Call;
}

const anyone = () => true;
const roles = (...allowed: string[]) => (asker: Asker) => allowed.includes(asker.role);
const rolesOrAdmin = (...allowed: string[]) => (asker: Asker) => asker.isAdmin || allowed.includes(asker.role);

const str = { type: "string" } as const;
const optionalString = { type: ["string", "null"] } as const;
const optionalNumber = { type: ["number", "null"] } as const;
const NONE = z.object({});
const NO_PARAMS = strictObject({});

function day(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Whole calendar days, not elapsed hours: something written at eight
 *  this morning is "today" at eight tonight, not "yesterday". */
function daysBetween(from: Date, to: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(to) - start(from)) / 86_400_000);
}

function ago(d: Date, today: Date): string {
  const n = daysBetween(d, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 730) return `${Math.round(n / 30)} months ago`;
  return `${Math.round(n / 365)} years ago`;
}

/** The start and end of a day, in the server's own time, like the queue's. */
function boundsOf(iso: string): { start: Date; end: Date } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { start: new Date(y, m - 1, d, 0, 0, 0, 0), end: new Date(y, m - 1, d, 23, 59, 59, 999) };
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const NO_PATIENT = sorry("Open a patient's file or visit first, or tell me who you mean.");

async function patientOnScreen(context: ActionContext) {
  if (!context.patientId) return null;
  return prisma.patient.findUnique({
    where: { id: context.patientId },
    select: { id: true, name: true, uhid: true, age: true, gender: true, allergies: true, chronicConditions: true, bloodGroup: true, deskNote: true },
  });
}

function medicineLine(m: { drugName: string; dosage: string; frequency: string; duration: string; instructions?: string | null }): string {
  return [m.drugName, m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).join(" · ");
}

/** What the app said when a write was refused, in its own words. */
function refusal(result: { status: number; body: any }, fallback: string): Reply {
  const said = typeof result.body?.error === "string" ? result.body.error : null;
  return sorry(said ?? fallback);
}

// ── Looking things up ─────────────────────────────────────────────────

/** Today's visits that are not over: who could be "opened" from the queue. */
async function liveVisitsToday(today: Date) {
  const { start, end } = boundsOf(isoOf(today));
  return prisma.appointment.findMany({
    where: { scheduledAt: { gte: start, lte: end }, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] } },
    select: { id: true, status: true, tokenNumber: true, priority: true, patientId: true, patient: { select: { name: true, category: true, dob: true, age: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

type LiveVisit = Awaited<ReturnType<typeof liveVisitsToday>>[number];
const FOUND = { id: true, name: true, uhid: true, age: true, gender: true, phone: true } as const;

/**
 * Everybody a name, phone number or file number could mean, best first.
 *
 * By the letters as given; and only if that finds nobody, by the name as
 * it SOUNDS (names.ts), because a name that was spoken arrives spelt
 * however the speech engine chose.
 */
async function patientsCalled(q: string, live: LiveVisit[]) {
  const byLetters = await prisma.patient.findMany({
    where: {
      mergedIntoId: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { uhid: { contains: q, mode: "insensitive" } },
        ...(q.replace(/\D/g, "").length >= 4 ? [{ phone: { contains: q.replace(/[\s-]/g, "") } }] : []),
      ],
    },
    select: FOUND,
    orderBy: { updatedAt: "desc" },
    take: 7,
  });
  if (byLetters.length > 0 || !/\p{L}/u.test(q)) return byLetters;

  // Names only: one narrow column of the register, read when a search
  // has already failed.
  const everyone = await prisma.patient.findMany({ where: { mergedIntoId: null }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 20_000 });
  const inQueue = new Set(live.map((v) => v.patientId));
  const fits = everyone
    .map((p) => ({ id: p.id, fit: nameFit(q, p.name) + (inQueue.has(p.id) ? 0.05 : 0) }))
    .filter((p) => p.fit >= 0.6)
    .sort((a, b) => b.fit - a.fit);
  // A name that fits in full beats those that only nearly do.
  const best = fits.filter((p) => p.fit >= (fits[0]?.fit ?? 0) - 0.06).slice(0, 7);
  if (best.length === 0) return [];
  const rows = await prisma.patient.findMany({ where: { id: { in: best.map((p) => p.id) } }, select: FOUND });
  return best.map((p) => rows.find((r) => r.id === p.id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
}

/**
 * The one patient a request named, for a request about somebody who is
 * not on screen: "note Ramesh Joshi's BP as 140 by 90", said from the
 * queue. Exactly one, or the reply that says why not. With their visit
 * today, when they have one, so the change lands on it.
 */
export async function patientNamed(name: string, today: Date): Promise<{ patientId: string; appointmentId: string | null; label: string } | { reply: Reply }> {
  const live = await liveVisitsToday(today);
  const found = await patientsCalled(name.trim(), live);
  if (found.length === 0) return { reply: sorry(`I could not find anyone called "${name}". Say the name again, or give their phone number.`) };
  const here = found.filter((p) => live.some((v) => v.patientId === p.id));
  const one = found.length === 1 ? found[0]! : here.length === 1 ? here[0]! : null;
  if (!one) {
    return {
      reply: {
        kind: "answer",
        title: `${found.length} patients are called "${name}". Open the one you mean, then ask again.`,
        lines: found.map((p) => ({ label: p.uhid, text: [p.name, p.age != null ? `${p.age}y` : null, p.gender, p.phone].filter(Boolean).join(" · "), to: `/patients/${p.id}` })),
      },
    };
  }
  const visit = live.find((v) => v.patientId === one.id && v.status === "IN_PROGRESS") ?? live.find((v) => v.patientId === one.id);
  return { patientId: one.id, appointmentId: visit?.id ?? null, label: [one.name, one.uhid, one.age != null ? `${one.age}y` : null, one.gender].filter(Boolean).join(" · ") };
}

/** Today's queue with nobody named in it: all a model needs to follow
 *  "the one with the doctor" or "the first one waiting". */
export async function queueInBrief(today: Date): Promise<string> {
  const live = await liveVisitsToday(today);
  if (live.length === 0) return "Today's queue is empty.";
  const tokens = (status: string) => live.filter((v) => v.status === status && v.tokenNumber != null).map((v) => v.tokenNumber).join(", ") || "none";
  return `Today's queue, by token number: with the doctor: ${tokens("IN_PROGRESS")}; waiting: ${tokens("CHECKED_IN")}; yet to arrive: ${live.filter((v) => v.status === "SCHEDULED").length} booked.`;
}

const VISIT_STATE: Record<string, string> = { SCHEDULED: "yet to arrive", CHECKED_IN: "waiting", IN_PROGRESS: "with the doctor" };

/**
 * Finds who was meant, and opens them.
 *
 * Tried in the order that is cheapest and surest: a token number from
 * today's queue; the letters as given, against name, phone and file
 * number; and only then the name as it SOUNDS (names.ts), because a name
 * that was spoken arrives spelt however the speech engine chose.
 *
 * For a doctor, a patient who is in today's queue opens at their visit,
 * which is where a doctor asking for them wants to be. Anybody else, and
 * anybody not in the queue, opens at their file.
 */
const findPatient: Action = {
  name: "find_patient",
  summary: "Finds a patient by name, phone number, file number (UHID) or today's token number, and opens them. Use it only when opening the patient is ALL they asked for: 'open Fatima Sayyed', 'call in Ramesh', 'find patient Joshi', including from the queue. When they asked for something about or for a named patient (their last prescription, their reports, record their BP, book them, order a test), do not use this: use the tool for that thing and give the name in its for_patient field. The name may have been misheard or misspelt; pass it as it was said, without words like 'patient' or 'queue'. For a token, pass 'token 5'.",
  kind: "read",
  schema: z.object({ query: z.string().trim().min(1).max(120), open: z.enum(["visit", "file"]).nullable().optional() }),
  jsonSchema: strictObject({
    query: { ...str, description: "The name, phone number or file number as it was said, or 'token N'." },
    open: { type: ["string", "null"], enum: ["visit", "file", null], description: "'file' only when they asked for the patient's file, record or history by that word. Otherwise leave it out." },
  }),
  allowed: anyone,
  async run(context, params: { query: string; open?: "visit" | "file" | null }) {
    const q = params.query.trim();
    const live = await liveVisitsToday(context.today);
    const visitOf = (patientId: string) => live.find((v) => v.patientId === patientId && v.status === "IN_PROGRESS") ?? live.find((v) => v.patientId === patientId);
    const wantsVisit = params.open === "visit" || (params.open !== "file" && context.asker.role === "DOCTOR");
    const open = (patient: { id: string; name: string }): Reply => {
      const visit = wantsVisit ? visitOf(patient.id) : undefined;
      return visit
        ? { kind: "go", to: `/appointments/${visit.id}/encounter`, say: `Opening ${patient.name}'s visit${visit.tokenNumber != null ? `, token ${visit.tokenNumber}` : ""}.` }
        : { kind: "go", to: `/patients/${patient.id}`, say: `Opening ${patient.name}'s file.` };
    };

    const token = /^(?:token|टोकन)\s*(?:no\.?|number|नंबर)?\s*(\d{1,3})$/iu.exec(q);
    if (token) {
      const visit = live.find((v) => v.tokenNumber === Number(token[1]));
      if (!visit) return sorry(`Nobody in today's queue has token ${token[1]}.`);
      return { kind: "go", to: `/appointments/${visit.id}/encounter`, say: `Opening ${visit.patient.name}'s visit, token ${visit.tokenNumber}.` };
    }
    if (q.length < 2) return sorry("Tell me the patient's name, phone number or token.");

    const found = await patientsCalled(q, live);
    if (found.length === 0) return sorry(`I could not find anyone called "${q}". Say the name again, or give their phone number or token.`);
    if (found.length === 1) return open(found[0]!);
    // Several by that name, and one of them is here today: that one first.
    const sorted = [...found].sort((a, b) => Number(Boolean(visitOf(b.id))) - Number(Boolean(visitOf(a.id))));
    return {
      kind: "answer",
      title: `${found.length === 7 ? "Several" : found.length} patients match "${q}"`,
      lines: sorted.map((p) => {
        const visit = visitOf(p.id);
        return {
          label: p.uhid,
          text: [p.name, p.age != null ? `${p.age}y` : null, p.gender, p.phone, visit ? `in today's queue, ${VISIT_STATE[visit.status]}` : null].filter(Boolean).join(" · "),
          to: visit && wantsVisit ? `/appointments/${visit.id}/encounter` : `/patients/${p.id}`,
        };
      }),
    };
  },
};

/**
 * "Call the next one." Opens the visit of whoever the queue would call
 * next: the same order the queue screen shows, emergencies first.
 */
const openNextPatient: Action = {
  name: "open_next_patient",
  summary: "Opens the visit of the next patient waiting in today's queue. Use it for 'next patient', 'call the next one', 'agla patient bulao', 'pudhcha patient'.",
  kind: "go",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const live = await liveVisitsToday(context.today);
    const waiting = live
      .filter((v) => v.status === "CHECKED_IN")
      .sort((a, b) => byTriage(a, b) || (a.tokenNumber ?? 9999) - (b.tokenNumber ?? 9999));
    const next = waiting[0];
    if (!next) return sorry("Nobody is waiting in the queue just now.");
    return { kind: "go", to: `/appointments/${next.id}/encounter`, say: `Opening ${next.patient.name}'s visit${next.tokenNumber != null ? `, token ${next.tokenNumber}` : ""}. ${waiting.length - 1} more waiting.` };
  },
};

/**
 * The patient in a few lines, for a doctor who has thirty seconds.
 *
 * Built by code from what is on file -- no model reads the record and
 * none could add to it. What a doctor needs before a patient sits down
 * is what is already written; the work is putting it in one place, and
 * that costs nothing.
 */
const patientBrief: Action = {
  name: "patient_brief",
  summary: "A short summary of the patient whose record is open: allergies, long-term conditions, recent visits, current medicines, tests awaited and follow-up due. Use it for 'summary', 'history', 'tell me about this patient', 'any allergies'.",
  kind: "read",
  needsPatient: true,
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const [sheets, lastRx, awaited, episodes] = await Promise.all([
      prisma.caseSheet.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 3, select: { createdAt: true, diagnosis: true, chiefComplaint: true, followUpDate: true, reminderResolvedAt: true } }),
      prisma.prescription.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, include: { items: true } }),
      isFeatureEnabled("labs") ? prisma.labOrder.findMany({ where: { patientId: patient.id, status: "ORDERED" }, include: { items: { select: { testName: true, completedAt: true } } }, take: 5 }) : Promise.resolve([]),
      prisma.careEpisode.findMany({ where: { patientId: patient.id, status: "ACTIVE" }, select: { formKey: true, startedOn: true } }),
    ]);

    const lines: Line[] = [];
    lines.push({ label: "Patient", text: [patient.name, patient.age != null ? `${patient.age} years` : null, patient.gender, patient.bloodGroup].filter(Boolean).join(" · ") });
    lines.push(patient.allergies ? { label: "Allergies", text: patient.allergies, tone: "danger" } : { label: "Allergies", text: "None on file", tone: "muted" });
    if (patient.chronicConditions) lines.push({ label: "Long-term", text: patient.chronicConditions });
    for (const e of episodes) lines.push({ label: "Ongoing", text: `${e.formKey.replace(/_/g, " ")}, since ${day(e.startedOn)}` });
    if (lastRx && lastRx.items.length > 0) {
      lines.push({ label: "Last medicines", text: `${lastRx.items.map((i) => i.drugName).join(", ")} (${ago(lastRx.createdAt, context.today)})` });
    }
    for (const s of sheets) {
      lines.push({ label: day(s.createdAt), text: [s.diagnosis, s.chiefComplaint].filter(Boolean).join(" — ") || "Visit, nothing written" });
    }
    if (sheets.length === 0) lines.push({ label: "Visits", text: "No earlier visit on file", tone: "muted" });
    const waiting = awaited.flatMap((o) => o.items.filter((i) => !i.completedAt).map((i) => i.testName));
    if (waiting.length > 0) lines.push({ label: "Tests awaited", text: waiting.join(", "), tone: "warning" });
    const due = sheets.find((s) => s.followUpDate && !s.reminderResolvedAt);
    if (due?.followUpDate) {
      const late = due.followUpDate.getTime() < context.today.getTime() - 86_400_000;
      lines.push({ label: "Follow-up", text: `${late ? "Was due" : "Due"} ${day(due.followUpDate)}`, tone: late ? "warning" : undefined });
    }
    if (patient.deskNote) lines.push({ label: "Desk note", text: patient.deskNote, tone: "muted" });
    return { kind: "answer", title: `${patient.name}, in brief`, lines, to: `/patients/${patient.id}`, toLabel: "Open the full file" };
  },
};

const lastPrescription: Action = {
  name: "last_prescription",
  summary: "Shows the most recent prescription of the patient whose record is open: each medicine with its dose, frequency and duration, and when it was given.",
  kind: "read",
  needsPatient: true,
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const rx = await prisma.prescription.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, include: { items: true, doctor: { select: { name: true } } } });
    if (!rx) return sorry(`${patient.name} has never been prescribed anything here.`);
    const old = daysBetween(rx.createdAt, context.today) > 180;
    return {
      kind: "answer",
      title: `${patient.name}'s last prescription, ${ago(rx.createdAt, context.today)}`,
      lines: [
        ...rx.items.map((i): Line => ({ text: medicineLine(i) })),
        { label: "Given by", text: `${rx.doctor.name} on ${day(rx.createdAt)}`, tone: "muted" },
        ...(old ? [{ text: "This is more than six months old. Worth confirming it still suits them before repeating it.", tone: "warning" } as Line] : []),
      ],
      to: `/patients/${patient.id}`,
      toLabel: "Open the full file",
    };
  },
};

const labResults: Action = {
  name: "lab_results",
  summary: "Shows the recent lab tests of the patient whose record is open, with results where they have come back and which are still awaited.",
  kind: "read",
  needsPatient: true,
  module: "labs",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const orders = await prisma.labOrder.findMany({ where: { patientId: patient.id, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" }, take: 4, include: { items: true } });
    if (orders.length === 0) return sorry(`No lab tests have been ordered for ${patient.name}.`);
    const ranges = new Map((await prisma.labTest.findMany({ select: { name: true, normalRange: true } })).map((t) => [t.name.trim().toLowerCase(), t.normalRange]));
    const lines: Line[] = [];
    for (const order of orders) {
      for (const item of order.items) {
        const range = ranges.get(item.testName.trim().toLowerCase());
        lines.push(
          item.completedAt
            ? { label: day(order.createdAt), text: `${item.testName}: ${item.resultText || (item.resultFileName ? "report attached" : "done")}${range ? `  (normal ${range})` : ""}` }
            : { label: day(order.createdAt), text: `${item.testName}: awaited`, tone: "warning" },
        );
      }
    }
    return { kind: "answer", title: `${patient.name}'s lab tests`, lines, to: "/labs", toLabel: "Open lab orders" };
  },
};

const visitHistory: Action = {
  name: "visit_history",
  summary: "Lists the earlier visits of the patient whose record is open, newest first, each with its date, diagnosis and complaint.",
  kind: "read",
  needsPatient: true,
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const sheets = await prisma.caseSheet.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 8, select: { createdAt: true, diagnosis: true, chiefComplaint: true, doctor: { select: { name: true } } } });
    if (sheets.length === 0) return sorry(`${patient.name} has no earlier visit written up here.`);
    return {
      kind: "answer",
      title: `${patient.name}'s visits`,
      lines: sheets.map((s) => ({ label: day(s.createdAt), text: [s.diagnosis, s.chiefComplaint].filter(Boolean).join(" — ") || "Nothing written" })),
      to: `/patients/${patient.id}`,
      toLabel: "Open the full file",
    };
  },
};

const visitOnDate: Action = {
  name: "visit_on_date",
  summary: "Shows what happened at the visit of the patient whose record is open on one particular day: the complaint, diagnosis, notes and the medicines given that day.",
  kind: "read",
  needsPatient: true,
  schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  jsonSchema: strictObject({ date: { ...str, description: "The day of the visit, as YYYY-MM-DD." } }),
  allowed: anyone,
  async run(context, params: { date: string }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const { start, end } = boundsOf(params.date);
    const [sheets, prescriptions] = await Promise.all([
      prisma.caseSheet.findMany({ where: { patientId: patient.id, createdAt: { gte: start, lte: end } }, include: { doctor: { select: { name: true } } } }),
      prisma.prescription.findMany({ where: { patientId: patient.id, createdAt: { gte: start, lte: end } }, include: { items: true } }),
    ]);
    if (sheets.length === 0 && prescriptions.length === 0) {
      // Not a dead end: say which days they did come, nearest first.
      const near = await prisma.caseSheet.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true, diagnosis: true } });
      return near.length === 0
        ? sorry(`${patient.name} has no visit on ${day(start)}, or on any other day.`)
        : { kind: "answer", title: `No visit on ${day(start)}. ${patient.name} came on:`, lines: near.map((s) => ({ label: day(s.createdAt), text: s.diagnosis || "Nothing written" })), to: `/patients/${patient.id}`, toLabel: "Open the full file" };
    }
    const lines: Line[] = [];
    for (const s of sheets) {
      if (s.chiefComplaint) lines.push({ label: "Complaint", text: s.chiefComplaint });
      if (s.hopi) lines.push({ label: "History", text: s.hopi });
      if (s.diagnosis) lines.push({ label: "Diagnosis", text: s.diagnosis });
      if (s.notes) lines.push({ label: "Notes", text: s.notes });
      const v = (s.vitals ?? {}) as Record<string, string>;
      const vitals = [v.bp && `BP ${v.bp}`, v.temp && `Temp ${v.temp}`, v.pulse && `Pulse ${v.pulse}`, v.spo2 && `SpO2 ${v.spo2}`, v.weight && `Wt ${v.weight}`].filter(Boolean).join("   ");
      if (vitals) lines.push({ label: "Vitals", text: vitals });
      lines.push({ label: "Seen by", text: s.doctor.name, tone: "muted" });
    }
    for (const rx of prescriptions) for (const i of rx.items) lines.push({ label: "Medicine", text: medicineLine(i) });
    return { kind: "answer", title: `${patient.name}, ${day(start)}`, lines, to: `/patients/${patient.id}`, toLabel: "Open the full file" };
  },
};

const vitalsTrend: Action = {
  name: "vitals_trend",
  summary: "Shows how the blood pressure, weight, pulse and other vitals of the patient whose record is open have changed over their recent visits.",
  kind: "read",
  needsPatient: true,
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context: RunContext) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const res = await context.call("GET", `/api/clinic/patients/${patient.id}/vitals-trend`);
    if (res.status !== 200) return refusal(res, "The vitals could not be read just now.");
    const points = ((res.body?.data ?? []) as { date: string; bp: { systolic: number; diastolic: number } | null; weight: number | null; pulse: number | null; spo2: number | null; temp: number | null }[]).slice(-6).reverse();
    if (points.length === 0) return sorry(`No vitals have been recorded for ${patient.name} yet.`);
    return {
      kind: "answer",
      title: `${patient.name}'s vitals, newest first`,
      lines: points.map((p) => ({
        label: day(p.date),
        text: [p.bp && `BP ${p.bp.systolic}/${p.bp.diastolic}`, p.weight != null && `Wt ${p.weight}`, p.pulse != null && `Pulse ${p.pulse}`, p.spo2 != null && `SpO2 ${p.spo2}`, p.temp != null && `Temp ${p.temp}`].filter(Boolean).join("   ") || "Nothing recorded",
      })),
      to: `/patients/${patient.id}`,
      toLabel: "See the chart",
    };
  },
};

const BILLING = ["RECEPTIONIST", "DOCTOR", "ADMIN", "CASHIER", "BILLING_CLERK"];

const patientDues: Action = {
  name: "patient_dues",
  summary: "Says how much the patient whose record is open still owes the clinic, bill by bill.",
  kind: "read",
  needsPatient: true,
  module: "billing",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: roles(...BILLING),
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const invoices = await prisma.invoice.findMany({ where: { patientId: patient.id }, include: { items: true, payments: true }, orderBy: { createdAt: "desc" }, take: 50 });
    const owing = invoices.map((inv) => ({ inv, sum: summarize(inv.items, inv.payments, inv) })).filter((x) => x.sum.balance > 0);
    if (owing.length === 0) return { kind: "answer", title: `${patient.name} owes nothing`, lines: [{ text: invoices.length === 0 ? "No bill has been raised for them." : "Every bill is paid in full.", tone: "muted" }] };
    const total = owing.reduce((n, x) => n + x.sum.balance, 0);
    return {
      kind: "answer",
      title: `${patient.name} owes ₹${total.toLocaleString("en-IN")}`,
      lines: owing.map((x) => ({ label: day(x.inv.createdAt), text: `₹${x.sum.balance.toLocaleString("en-IN")} of ₹${x.sum.total.toLocaleString("en-IN")} still to pay` })),
      to: "/billing",
      toLabel: "Open billing",
    };
  },
};

const RELATION_WORDS: Record<string, string> = { SPOUSE: "Spouse", PARTNER: "Partner", FATHER: "Father", MOTHER: "Mother", CHILD: "Child", SIBLING: "Brother or sister", GUARDIAN: "Guardian", OTHER: "Relative" };

const familyMembers: Action = {
  name: "family_members",
  summary: "Lists the family members linked to the patient whose record is open.",
  kind: "read",
  needsPatient: true,
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: (asker) => asker.isAdmin || !["CASHIER", "BILLING_CLERK"].includes(asker.role),
  async run(context) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const relations = await prisma.patientRelation.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "asc" } });
    if (relations.length === 0) return sorry(`No family members are linked to ${patient.name} yet. You can ask me to add one.`);
    return {
      kind: "answer",
      title: `${patient.name}'s family`,
      lines: relations.map((r) => ({
        label: RELATION_WORDS[r.kind] ?? r.kind,
        text: [r.name, r.age != null ? `${r.age}y` : null, r.gender, r.phone, r.notes].filter(Boolean).join(" · "),
        to: r.relatedPatientId ? `/patients/${r.relatedPatientId}` : undefined,
      })),
      to: `/patients/${patient.id}`,
      toLabel: "Open the full file",
    };
  },
};

const queueSummary: Action = {
  name: "queue_summary",
  summary: "Says how today's queue stands: how many are waiting, with the doctor, seen and yet to arrive, and who is next.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context) {
    const { start, end } = boundsOf(isoOf(context.today));
    const visits = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lte: end } },
      select: { id: true, status: true, tokenNumber: true, priority: true, scheduledAt: true, checkedInAt: true, patient: { select: { name: true, category: true, allergies: true } } },
      orderBy: { scheduledAt: "asc" },
    });
    if (visits.length === 0) return { kind: "answer", title: "Nobody is booked today", lines: [{ text: "The queue is empty.", tone: "muted" }], to: "/queue", toLabel: "Open the queue" };
    const count = (s: string) => visits.filter((v) => v.status === s).length;
    const waiting = visits.filter((v) => v.status === "CHECKED_IN").sort((a, b) => byTriage(a, b) || (a.tokenNumber ?? 9999) - (b.tokenNumber ?? 9999));
    const lines: Line[] = [
      { label: "Waiting", text: String(waiting.length) },
      { label: "With the doctor", text: String(count("IN_PROGRESS")) },
      { label: "Seen", text: String(count("COMPLETED")) },
      { label: "Yet to arrive", text: String(count("SCHEDULED")) },
    ];
    for (const [i, v] of waiting.slice(0, 3).entries()) {
      const urgent = (v.priority ?? v.patient.category) === "EMERGENCY";
      lines.push({
        label: i === 0 ? "Next" : "Then",
        text: `${v.tokenNumber != null ? `Token ${v.tokenNumber} · ` : ""}${v.patient.name}${urgent ? " · EMERGENCY" : ""}${v.patient.allergies ? ` · allergic to ${v.patient.allergies}` : ""}`,
        to: `/appointments/${v.id}/encounter`,
        tone: urgent ? "danger" : undefined,
      });
    }
    return { kind: "answer", title: `${visits.length} booked today`, lines, to: "/queue", toLabel: "Open the queue" };
  },
};

const needsAttention: Action = {
  name: "needs_attention",
  summary: "Lists what in the clinic is waiting to be dealt with right now: follow-ups due, lab results awaited, prescriptions to dispense, visits not billed.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context: RunContext) {
    const res = await context.call("GET", "/api/clinic/dashboard");
    // Said as a failure. "Nothing is waiting on you" must mean that it
    // was looked up and nothing was, never that the look-up did not work.
    if (res.status !== 200) return refusal(res, "What is waiting could not be read just now.");
    const attention = (res.body?.attention ?? []) as { label: string; count: number; href: string; severity: string }[];
    if (attention.length === 0) return { kind: "answer", title: "Nothing is waiting on you", lines: [{ text: "No follow-ups due, no results awaited, nothing unbilled.", tone: "muted" }] };
    return { kind: "answer", title: "Waiting to be dealt with", lines: attention.map((a) => ({ label: String(a.count), text: a.label, to: a.href, tone: a.severity === "warn" ? "warning" : undefined })) };
  },
};

const followupsDue: Action = {
  name: "followups_due",
  summary: "Lists the patients who are due or overdue to come back for a follow-up.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: anyone,
  async run(context: RunContext) {
    const res = await context.call("GET", "/api/clinic/reminders");
    if (res.status !== 200) return refusal(res, "The follow-ups could not be read just now.");
    const rows = (res.body?.data ?? []) as { followUpDate: string; diagnosis: string | null; patient: { id: string; name: string; phone: string | null } }[];
    if (rows.length === 0) return { kind: "answer", title: "No follow-ups are due", lines: [{ text: "Nobody is due back in the next week.", tone: "muted" }] };
    return {
      kind: "answer",
      title: `${res.body.due ?? 0} due now, ${res.body.upcoming ?? 0} in the next week`,
      lines: rows.slice(0, 10).map((r) => {
        const late = new Date(r.followUpDate).getTime() < context.today.getTime();
        return { label: day(r.followUpDate), text: [r.patient.name, r.diagnosis, r.patient.phone].filter(Boolean).join(" · "), to: `/patients/${r.patient.id}`, tone: late ? "warning" : undefined };
      }),
      to: "/reminders",
      toLabel: "Open follow-ups",
    };
  },
};

const recallList: Action = {
  name: "recall_list",
  summary: "Lists patients who should have come back and have not: those whose follow-up date has passed, and those with a long-term condition (diabetes, blood pressure and the like) who have not been seen for some months. Use it for 'who has stopped coming', 'patients not seen in three months', 'who should I call back'.",
  kind: "read",
  schema: z.object({ months: z.number().int().min(1).max(36).nullable().optional() }),
  jsonSchema: strictObject({ months: { type: ["number", "null"], description: "How many months without a visit counts as gone quiet. Leave out for the usual six." } }),
  allowed: anyone,
  async run(context: RunContext, params: { months?: number | null }) {
    const res = await context.call("GET", `/api/clinic/patients-recall?months=${params.months ?? 6}`);
    if (res.status !== 200) return refusal(res, "The recall list could not be read.");
    type Row = { patientId: string; name: string; phone: string | null; detail: string; dueOn: string | null; lastSeen: string | null };
    const overdue = (res.body.overdue ?? []) as Row[];
    const quiet = (res.body.quiet ?? []) as Row[];
    if (overdue.length === 0 && quiet.length === 0) {
      return { kind: "answer", title: "Nobody is overdue to come back", lines: [{ text: `No missed follow-ups, and no long-term patient unseen for ${res.body.quietMonths} months.`, tone: "muted" }] };
    }
    const lines: Line[] = [
      ...overdue.slice(0, 6).map((r): Line => ({ label: "Missed", text: [r.name, r.detail, r.phone].filter(Boolean).join(" · "), to: `/patients/${r.patientId}`, tone: "warning" })),
      ...quiet.slice(0, 6).map((r): Line => ({ label: "Gone quiet", text: [r.name, r.detail, r.lastSeen ? `last seen ${day(r.lastSeen)}` : null, r.phone].filter(Boolean).join(" · "), to: `/patients/${r.patientId}` })),
    ];
    return { kind: "answer", title: `${overdue.length} missed a follow-up, ${quiet.length} gone quiet for ${res.body.quietMonths} months`, lines, to: "/reminders", toLabel: "Open follow-ups" };
  },
};

const todaysCollection: Action = {
  name: "todays_collection",
  summary: "Says how much money the clinic has collected today, split by cash, UPI and card, and how much is outstanding.",
  kind: "read",
  module: "billing",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: roles("DOCTOR", "ADMIN", "RECEPTIONIST"),
  async run(context: RunContext) {
    const res = await context.call("GET", "/api/clinic/dashboard");
    if (res.status !== 200) return refusal(res, "The day's takings could not be read just now.");
    const money = res.body?.money as { collectedToday: number; byMode: Record<string, number>; outstanding: number; unbilledVisits: number } | null;
    if (!money) return sorry("The day's takings are not shown to your login.");
    const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
    return {
      kind: "answer",
      title: `${rupees(money.collectedToday)} collected today`,
      lines: [
        ...Object.entries(money.byMode).filter(([, v]) => v !== 0).map(([mode, v]): Line => ({ label: mode === "UPI" ? "UPI" : mode.charAt(0) + mode.slice(1).toLowerCase(), text: rupees(v) })),
        { label: "Still owed", text: rupees(money.outstanding), tone: money.outstanding > 0 ? "warning" : "muted" },
        ...(money.unbilledVisits > 0 ? [{ label: "Not billed", text: `${money.unbilledVisits} visit${money.unbilledVisits === 1 ? "" : "s"} seen today with no bill`, tone: "warning" } as Line] : []),
      ],
      to: "/billing",
      toLabel: "Open billing",
    };
  },
};

const assistantUsage: Action = {
  name: "assistant_usage",
  summary: "Says how much the assistant itself has been used today and over the last thirty days, and roughly what that cost: minutes listened, requests answered by rule for nothing, and requests that needed a model.",
  kind: "read",
  schema: NONE,
  jsonSchema: NO_PARAMS,
  allowed: (asker) => asker.isAdmin,
  async run() {
    const used = await meterUsage();
    if (!used) return sorry("The assistant's usage could not be read just now.");
    const rupees = (n: number) => `₹${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en-IN")}`;
    const today = estimatedRupees(used.today);
    const month = estimatedRupees(used.month);
    const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
    return {
      kind: "answer",
      title: `About ${rupees(today.total)} today, ${rupees(month.total)} in the last 30 days`,
      lines: [
        { label: "Listened", text: `${minutes(used.today.audioSeconds)} today · ${minutes(used.month.audioSeconds)} in 30 days · about ${rupees(month.speech)}` },
        { label: "By a model", text: `${used.today.modelCalls} today · ${used.month.modelCalls} in 30 days · about ${rupees(month.model)}` },
        { label: "By rule, free", text: `${used.today.ruleAnswers} today · ${used.month.ruleAnswers} in 30 days` },
        { label: "Daily ceiling", text: `${used.ceilings.audioMinutes} minutes of listening, ${used.ceilings.modelCalls} model requests`, tone: "muted" },
        { text: "These are estimates from the providers' published rates. Their invoices are the exact figures.", tone: "muted" },
      ],
    };
  },
};

// ── Going somewhere ───────────────────────────────────────────────────

/** Which module a screen belongs to, so a screen the plan does not have
 *  is explained rather than opened onto a refusal. */
const SCREEN_MODULE: Record<string, Feature> = {
  labs: "labs", pharmacy: "pharmacy", billing: "billing", expenses: "expenses", analytics: "analytics",
  counter: "cashcounter", ipd: "ipd", nursing: "nursing", ot: "ot", radiology: "radiology", departments: "departments", staff: "staff",
};

const openScreen: Action = {
  name: "open_screen",
  summary: "Opens one of the app's screens: queue, overview, patients, requests, reminders, labs, pharmacy, billing, expenses, analytics (reports), counter, claims, ipd (bed board), nursing, ot, radiology, departments, website, staff, settings, audit.",
  kind: "go",
  schema: z.object({ screen: z.string() }),
  jsonSchema: strictObject({ screen: { type: "string", enum: SCREENS.map((s) => s.key) } }),
  allowed: anyone,
  async run(context, params: { screen: string }) {
    const screen = SCREENS.find((s) => s.key === params.screen);
    if (!screen) return sorry("I do not know that screen.");
    const module = SCREEN_MODULE[screen.key];
    if (module && !isFeatureEnabled(module)) return sorry(`${screen.label} is not part of this clinic's plan.`);
    if (screen.key === "claims" && !isFeatureEnabled("insurance") && !isFeatureEnabled("schemes")) return sorry("Claims are not part of this clinic's plan.");
    if (["website", "staff", "audit"].includes(screen.key) && !context.asker.isAdmin) return sorry(`${screen.label} is for the clinic's admin.`);
    return { kind: "go", to: screen.path, say: `Opening ${screen.label}.` };
  },
};

// ── Changing things: each is a card first, and a route call after ─────

const addFamilyMember: Action = {
  name: "add_family_member",
  summary: "Adds a family member to the patient whose record is open: their husband, wife, mother, father, child, brother or sister, or guardian. Give the relation and the person's name, and anything else that was said about them (age, sex, phone, a note such as 'has diabetes').",
  kind: "write",
  needsPatient: true,
  schema: z.object({
    relation: z.enum(["SPOUSE", "PARTNER", "FATHER", "MOTHER", "CHILD", "SIBLING", "GUARDIAN", "OTHER"]),
    name: z.string().trim().min(2).max(120),
    age: z.number().int().min(0).max(120).nullable().optional(),
    gender: z.string().max(20).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    relatedPatientId: z.string().nullable().optional(),
  }),
  jsonSchema: strictObject({
    relation: { type: "string", enum: ["SPOUSE", "PARTNER", "FATHER", "MOTHER", "CHILD", "SIBLING", "GUARDIAN", "OTHER"], description: "Husband or wife is SPOUSE; son or daughter is CHILD; brother or sister is SIBLING." },
    name: { ...str, description: "The family member's name as it was said." },
    age: optionalNumber,
    gender: { ...optionalString, description: "Male or Female, if it was said or is plain from the relation (husband, mother)." },
    phone: optionalString,
    notes: { ...optionalString, description: "Anything clinical that was said about them, in a few words." },
  }),
  allowed: rolesOrAdmin("DOCTOR", "NURSE", "RECEPTIONIST"),
  async preview(context, params: { relation: string; name: string; age?: number | null; gender?: string | null; phone?: string | null; notes?: string | null }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    // Already a patient here? Linking the two files is worth more than a
    // second copy of their name. Only on an unmistakable match: one
    // person, the same name, and the phone number when one was given.
    const matches = await prisma.patient.findMany({
      where: { mergedIntoId: null, id: { not: patient.id }, name: { equals: params.name, mode: "insensitive" }, ...(params.phone ? { phone: { contains: params.phone.replace(/\D/g, "").slice(-10) } } : {}) },
      select: { id: true, name: true, uhid: true, age: true, gender: true },
      take: 2,
    });
    const existing = matches.length === 1 ? matches[0]! : null;
    return {
      kind: "confirm",
      action: "add_family_member",
      params: { ...params, relatedPatientId: existing?.id ?? null },
      title: `Add ${params.name} to ${patient.name}'s family?`,
      lines: [
        { label: "Relation", text: RELATION_WORDS[params.relation] ?? params.relation },
        { label: "Name", text: params.name },
        ...(params.age != null ? [{ label: "Age", text: String(params.age) }] : []),
        ...(params.gender ? [{ label: "Sex", text: params.gender }] : []),
        ...(params.phone ? [{ label: "Phone", text: params.phone }] : []),
        ...(params.notes ? [{ label: "Note", text: params.notes }] : []),
        existing
          ? { text: `${existing.name} already has a file here (${existing.uhid}). The two files will be linked.`, tone: "muted" as const }
          : { text: "They have no file of their own here; only their details are kept on this patient's file.", tone: "muted" as const },
      ],
    };
  },
  async run(context: RunContext, params: { relation: string; name: string; age?: number | null; gender?: string | null; phone?: string | null; notes?: string | null; relatedPatientId?: string | null }) {
    if (!context.patientId) return NO_PATIENT;
    const res = await context.call("POST", `/api/clinic/patients/${context.patientId}/relations`, {
      kind: params.relation, name: params.name, age: params.age ?? null, gender: params.gender ?? null,
      phone: params.phone ?? null, notes: params.notes ?? null, relatedPatientId: params.relatedPatientId ?? null,
    });
    if (res.status !== 201) return refusal(res, "They could not be added.");
    return { kind: "done", say: `${params.name} is now on the family list.`, to: `/patients/${context.patientId}` };
  },
};

const recordVitals: Action = {
  name: "record_vitals",
  summary: "Records vitals on the visit that is open: blood pressure, temperature, SpO2, weight, pulse. Give only the ones that were said.",
  kind: "write",
  needsPatient: true,
  schema: z.object({
    bp: z.string().max(20).nullable().optional(), temp: z.string().max(20).nullable().optional(), spo2: z.string().max(10).nullable().optional(),
    weight: z.string().max(20).nullable().optional(), pulse: z.string().max(20).nullable().optional(),
  }),
  jsonSchema: strictObject({
    bp: { ...optionalString, description: "As systolic/diastolic, like 130/80." },
    temp: optionalString, spo2: optionalString, weight: { ...optionalString, description: "In kg, number only." }, pulse: optionalString,
  }),
  allowed: roles("RECEPTIONIST", "NURSE", "DOCTOR", "ADMIN"),
  async preview(context, params: Record<string, string | null | undefined>) {
    if (!context.appointmentId) return sorry("Open the patient's visit first: vitals are recorded on a visit.");
    const said = Object.entries(params).filter(([, v]) => v);
    if (said.length === 0) return sorry("Tell me the numbers, for example: BP 130 by 80, weight 72.");
    const labels: Record<string, string> = { bp: "BP", temp: "Temperature", spo2: "SpO2", weight: "Weight", pulse: "Pulse" };
    return { kind: "confirm", action: "record_vitals", params: Object.fromEntries(said), title: "Record these vitals on this visit?", lines: said.map(([k, v]) => ({ label: labels[k] ?? k, text: String(v) })) };
  },
  async run(context: RunContext, params: Record<string, string | null | undefined>) {
    if (!context.appointmentId) return sorry("Open the patient's visit first.");
    // The route replaces the whole set, so what was already recorded --
    // by reception, a minute ago -- is read first and kept.
    const visit = await prisma.appointment.findUnique({ where: { id: context.appointmentId }, select: { vitals: true } });
    const merged = { ...((visit?.vitals ?? {}) as Record<string, string>), ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) };
    const res = await context.call("PATCH", `/api/clinic/appointments/${context.appointmentId}/vitals`, merged);
    if (res.status !== 200) return refusal(res, "The vitals could not be recorded.");
    return { kind: "done", say: "Vitals recorded on this visit." };
  },
};

const bookVisit: Action = {
  name: "book_visit",
  summary: "Books the patient whose record is open for a visit on a future day, for example a follow-up 'after two weeks' or 'on 5 December'. Give the day; a reason if one was said.",
  kind: "write",
  needsPatient: true,
  schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(500).nullable().optional() }),
  jsonSchema: strictObject({ date: { ...str, description: "The day of the visit as YYYY-MM-DD, worked out from today's date." }, reason: optionalString }),
  allowed: anyone,
  async preview(context, params: { date: string; reason?: string | null }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const when = boundsOf(params.date).start;
    if (when.getTime() < boundsOf(isoOf(context.today)).start.getTime()) return sorry("That day has already passed.");
    if (daysBetween(context.today, when) > 366) return sorry("That is more than a year away. Tell me a nearer day.");
    const already = await prisma.appointment.count({ where: { patientId: patient.id, scheduledAt: { gte: when, lte: boundsOf(params.date).end }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } });
    return {
      kind: "confirm",
      action: "book_visit",
      params,
      title: `Book ${patient.name} for ${when.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}?`,
      lines: [
        ...(params.reason ? [{ label: "For", text: params.reason }] : []),
        { text: "Booked for 10:00 in the morning. The time can be changed from the queue.", tone: "muted" },
        ...(already > 0 ? [{ text: "They are already booked on that day.", tone: "warning" } as Line] : []),
      ],
    };
  },
  async run(context: RunContext, params: { date: string; reason?: string | null }) {
    if (!context.patientId) return NO_PATIENT;
    const at = boundsOf(params.date).start;
    at.setHours(10, 0, 0, 0);
    // With the same doctor as today's visit, when there is one.
    const today = context.appointmentId ? await prisma.appointment.findUnique({ where: { id: context.appointmentId }, select: { doctorId: true } }) : null;
    const doctorId = today?.doctorId ?? (context.asker.role === "DOCTOR" ? context.asker.userId : undefined);
    const res = await context.call("POST", "/api/clinic/appointments", { patientId: context.patientId, scheduledAt: at.toISOString(), reason: params.reason ?? "Follow-up", ...(doctorId ? { doctorId } : {}) });
    if (res.status !== 201) return refusal(res, "The visit could not be booked.");
    return { kind: "done", say: `Booked for ${day(at)}.`, to: "/queue" };
  },
};

const orderTests: Action = {
  name: "order_tests",
  summary: "Orders lab tests for the patient whose record is open. Give each test by the name that was said (CBC, sugar fasting, thyroid, ECG and so on).",
  kind: "write",
  needsPatient: true,
  module: "labs",
  schema: z.object({ tests: z.array(z.string().min(2).max(120)).min(1).max(15) }),
  jsonSchema: strictObject({ tests: { type: "array", items: str, description: "Each test as it was said." } }),
  allowed: roles("DOCTOR"),
  async preview(context, params: { tests: string[] }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const catalogue = (await prisma.labTest.findMany({ select: { name: true } })).map((t) => t.name);
    const matched = new Set<string>();
    const unknown: string[] = [];
    for (const said of params.tests) {
      const hits = readLabTests(said, catalogue);
      const exact = catalogue.find((c) => c.toLowerCase() === said.toLowerCase());
      if (exact) matched.add(exact);
      else if (hits.length > 0) hits.forEach((h) => matched.add(h));
      else unknown.push(said);
    }
    if (matched.size === 0) return sorry(`None of those is on this clinic's test list: ${unknown.join(", ")}. Add it in Lab orders, or tell me another name for it.`);
    return {
      kind: "confirm",
      action: "order_tests",
      params: { tests: [...matched] },
      title: `Order ${matched.size === 1 ? "this test" : `these ${matched.size} tests`} for ${patient.name}?`,
      lines: [
        ...[...matched].map((t): Line => ({ text: t })),
        ...(unknown.length > 0 ? [{ text: `Not on the clinic's test list, so not ordered: ${unknown.join(", ")}`, tone: "warning" } as Line] : []),
      ],
    };
  },
  async run(context: RunContext, params: { tests: string[] }) {
    if (!context.patientId) return NO_PATIENT;
    const res = await context.call("POST", "/api/clinic/lab-orders", { patientId: context.patientId, appointmentId: context.appointmentId ?? undefined, testNames: params.tests });
    if (res.status !== 201) return refusal(res, "The tests could not be ordered.");
    return { kind: "done", say: `Ordered: ${params.tests.join(", ")}.`, to: "/labs" };
  },
};

const addCharge: Action = {
  name: "add_charge",
  summary: "Adds a charge to the bill of the visit that is open, by the name of the service or procedure as the clinic lists it (dressing, ECG, injection, general consultation, follow-up consultation). Keep every word of the name that was said, including 'general' or 'follow-up'.",
  kind: "write",
  needsPatient: true,
  module: "billing",
  schema: z.object({ item: z.string().min(2).max(120), quantity: z.number().int().min(1).max(100).nullable().optional(), serviceItemId: z.string().optional() }),
  jsonSchema: strictObject({ item: { ...str, description: "The service or procedure as it was said." }, quantity: optionalNumber }),
  allowed: roles(...BILLING),
  async preview(context, params: { item: string; quantity?: number | null }) {
    if (!context.appointmentId) return sorry("Open the patient's visit first: a charge goes on a visit's bill.");
    const items = await prisma.serviceItem.findMany({ where: { isActive: true, name: { contains: params.item, mode: "insensitive" } }, orderBy: [{ doctorId: "desc" }, { name: "asc" }], take: 5 });
    if (items.length === 0) return sorry(`"${params.item}" is not on the clinic's price list. Add it under Settings, or add the charge by hand on the visit.`);
    if (items.length > 1 && !items.some((i) => i.name.toLowerCase() === params.item.toLowerCase())) {
      return { kind: "answer", title: `Which one do you mean by "${params.item}"?`, lines: items.map((i) => ({ text: `${i.name} · ₹${Number(i.defaultPrice).toLocaleString("en-IN")}` })) };
    }
    const item = items.find((i) => i.name.toLowerCase() === params.item.toLowerCase()) ?? items[0]!;
    const quantity = params.quantity ?? 1;
    return {
      kind: "confirm",
      action: "add_charge",
      params: { item: item.name, quantity, serviceItemId: item.id },
      title: "Add this charge to the visit's bill?",
      lines: [{ label: "Charge", text: item.name }, { label: "Amount", text: `₹${(Number(item.defaultPrice) * quantity).toLocaleString("en-IN")}${quantity > 1 ? ` (${quantity} × ₹${Number(item.defaultPrice).toLocaleString("en-IN")})` : ""}` }],
    };
  },
  async run(context: RunContext, params: { item: string; quantity?: number | null; serviceItemId?: string }) {
    if (!context.appointmentId || !params.serviceItemId) return sorry("Open the patient's visit first.");
    const bill = await context.call("GET", `/api/clinic/appointments/${context.appointmentId}/invoice`);
    if (bill.status >= 400 || !bill.body?.id) return refusal(bill, "The visit's bill could not be opened.");
    const res = await context.call("POST", `/api/clinic/invoices/${bill.body.id}/items`, { serviceItemId: params.serviceItemId, quantity: params.quantity ?? 1 });
    if (res.status >= 400) return refusal(res, "The charge could not be added.");
    return { kind: "done", say: `${params.item} added. The bill now stands at ₹${Number(res.body.total ?? 0).toLocaleString("en-IN")}.` };
  },
};

const issueCertificate: Action = {
  name: "issue_certificate",
  summary: "Issues a medical certificate for the patient whose record is open: sick leave (give how many days of rest from today, or the dates), fitness, or a referral letter (give who it is to and why).",
  kind: "write",
  needsPatient: true,
  schema: z.object({
    type: z.enum(["SICK_LEAVE", "FITNESS", "REFERRAL"]),
    days: z.number().int().min(1).max(180).nullable().optional(),
    referredTo: z.string().max(200).nullable().optional(),
    reason: z.string().max(1000).nullable().optional(),
  }),
  jsonSchema: strictObject({
    type: { type: "string", enum: ["SICK_LEAVE", "FITNESS", "REFERRAL"] },
    days: { ...optionalNumber, description: "For sick leave: days of rest, starting today." },
    referredTo: { ...optionalString, description: "For a referral: the doctor or hospital." },
    reason: { ...optionalString, description: "The illness, or the reason for the referral, in a few words." },
  }),
  allowed: roles("DOCTOR"),
  async preview(context, params: { type: string; days?: number | null; referredTo?: string | null; reason?: string | null }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    if (params.type === "SICK_LEAVE" && !params.days) return sorry("For how many days of rest?");
    if (params.type === "REFERRAL" && !params.referredTo) return sorry("Who should the referral be addressed to?");
    const words: Record<string, string> = { SICK_LEAVE: "sick leave certificate", FITNESS: "fitness certificate", REFERRAL: "referral letter" };
    const to = new Date(context.today);
    to.setDate(to.getDate() + (params.days ?? 1) - 1);
    return {
      kind: "confirm",
      action: "issue_certificate",
      params,
      title: `Issue a ${words[params.type]} for ${patient.name}?`,
      lines: [
        ...(params.type === "SICK_LEAVE" ? [{ label: "Rest", text: `${params.days} day${params.days === 1 ? "" : "s"}, ${day(context.today)} to ${day(to)}` }] : []),
        ...(params.referredTo ? [{ label: "To", text: params.referredTo }] : []),
        ...(params.reason ? [{ label: "For", text: params.reason }] : []),
        { text: "It is issued in your name, on the clinic's own certificate wording.", tone: "muted" },
      ],
    };
  },
  async run(context: RunContext, params: { type: string; days?: number | null; referredTo?: string | null; reason?: string | null }) {
    if (!context.patientId) return NO_PATIENT;
    const from = new Date(context.today);
    const to = new Date(context.today);
    to.setDate(to.getDate() + (params.days ?? 1) - 1);
    const template = await prisma.certificateTemplate.findFirst({ where: { type: params.type as never, isActive: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true } }).catch(() => null);
    const res = await context.call("POST", "/api/clinic/certificates", {
      patientId: context.patientId,
      appointmentId: context.appointmentId ?? undefined,
      type: params.type,
      ...(params.type === "SICK_LEAVE" ? { fromDate: from.toISOString(), toDate: to.toISOString() } : {}),
      ...(template ? { templateId: template.id } : {}),
      referredTo: params.referredTo ?? undefined,
      reason: params.reason ?? undefined,
    });
    if (res.status !== 201) return refusal(res, "The certificate could not be issued.");
    return { kind: "done", say: "The certificate is issued. It is on the patient's file, ready to print.", to: `/patients/${context.patientId}` };
  },
};

const FREQUENCY_WORDS = ["OD", "BD", "TDS", "QID", "SOS", "STAT"];

/**
 * A prescription, said aloud.
 *
 * The same care the listening assistant takes with a medicine is taken
 * here, by the same code: the name is matched against the doctor's own
 * past prescriptions and then the catalogue, never taken on the model's
 * word, and the card says so when it was matched by a close spelling,
 * when the patient's file lists an allergy to it, or when two lines
 * carry the same salt. A dose that was not said is not supplied: the
 * card is refused, and says what is still needed.
 */
const writePrescription: Action = {
  name: "write_prescription",
  summary: "Writes a prescription for the patient whose record is open. Give each medicine with its name and strength, and the dose pattern (like 1-0-1), frequency (OD, BD, TDS, QID, SOS or STAT), duration (like 5 days) and instructions that were said. Use it for 'prescribe', 'give her', 'start him on'.",
  kind: "write",
  needsPatient: true,
  schema: z.object({
    medicines: z.array(z.object({
      name: z.string().trim().min(2).max(200),
      dosage: z.string().max(50).nullable().optional(),
      frequency: z.string().max(10).nullable().optional(),
      duration: z.string().max(50).nullable().optional(),
      instructions: z.string().max(200).nullable().optional(),
      drugId: z.string().nullable().optional(),
    })).min(1).max(15),
  }),
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["medicines"],
    properties: {
      medicines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            name: { type: "string", description: "The medicine and its strength as said, like 'Dolo 650'." },
            dosage: { type: "string", description: "Morning-afternoon-night pattern like 1-0-1, or an amount like 5 ml. Leave out if not said." },
            frequency: { type: "string", enum: FREQUENCY_WORDS, description: "Leave out if not said." },
            duration: { type: "string", description: "Like '5 days' or '2 weeks'. Leave out if not said." },
            instructions: { type: "string", description: "Like 'After food'. Leave out if not said." },
          },
        },
      },
    },
  },
  allowed: roles("DOCTOR"),
  async preview(context, params: { medicines: { name: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[] }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    const habits = await doctorHabits(context.asker.userId);
    const host = clinicHost(context.asker.userId, habits);
    const resolved = await Promise.all(params.medicines.map((m) => {
      // What was said in words is read the same way the listening
      // assistant reads it: "twice a day" is BD and 1-0-1.
      const said = readSchedule([m.dosage, m.frequency].filter(Boolean).join(" "));
      const frequency = (m.frequency && FREQUENCY_WORDS.includes(m.frequency.toUpperCase()) ? m.frequency.toUpperCase() : said.frequency) as Frequency | "";
      return resolveMedicine({
        spoken: m.name,
        dosage: (m.dosage ?? "").trim() || said.dosage,
        frequency,
        duration: readDuration(m.duration ?? "") || (m.duration ?? "").trim(),
        instructions: (m.instructions ?? "").trim(),
        source: m.name,
      }, habits, host);
    }));

    const incomplete = resolved.filter((m) => !m.dosage || !m.frequency || !m.duration);
    if (incomplete.length > 0) {
      const need = incomplete.map((m) => `${m.drugName}: ${[!m.dosage && "dose", !m.frequency && "how often", !m.duration && "for how long"].filter(Boolean).join(", ")}`).join("; ");
      return sorry(`I need a little more before I can write that. ${need}. Say it again with those.`);
    }

    // "Could not be traced to what was said" is a check for a transcript;
    // here the doctor said it to the assistant directly.
    const flags = checkDraft({ medicines: resolved, transcript: resolved.map((m) => m.source).join(". "), allergies: patient.allergies }).filter((f) => f.kind !== "unverified");
    const lines: Line[] = [];
    resolved.forEach((m, i) => {
      lines.push({ text: `${i + 1}.  ${medicineLine(m)}` });
      if (m.composition) lines.push({ text: m.composition, tone: "muted" });
      for (const note of m.notes) lines.push({ text: note, tone: "muted" });
      for (const f of flags.filter((x) => x.medicine === i)) lines.push({ text: f.message, tone: f.level === "danger" ? "danger" : "warning" });
    });
    return {
      kind: "confirm",
      action: "write_prescription",
      params: { medicines: resolved.map((m) => ({ name: m.drugName, drugId: m.drugId, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions || null })) },
      title: `Write this prescription for ${patient.name}?`,
      lines,
    };
  },
  async run(context: RunContext, params: { medicines: { name: string; drugId?: string | null; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null }[] }) {
    if (!context.patientId) return NO_PATIENT;
    const res = await context.call("POST", "/api/clinic/prescriptions", {
      patientId: context.patientId,
      appointmentId: context.appointmentId ?? undefined,
      items: params.medicines.map((m) => ({ drugId: m.drugId ?? undefined, drugName: m.name, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "", instructions: m.instructions ?? undefined })),
    });
    if (res.status !== 201) return refusal(res, "The prescription could not be saved. Every medicine needs a dose, a frequency and a duration.");
    return { kind: "done", say: `Prescription saved: ${params.medicines.map((m) => m.name).join(", ")}.`, to: context.appointmentId ? `/appointments/${context.appointmentId}/encounter` : `/patients/${context.patientId}` };
  },
};

const addToQueue: Action = {
  name: "add_to_queue",
  summary: "Adds the patient whose record is open to today's queue as having arrived, and gives them a token. Use it for 'check in', 'add to queue', 'walk-in'.",
  kind: "write",
  needsPatient: true,
  schema: z.object({ reason: z.string().max(500).nullable().optional() }),
  jsonSchema: strictObject({ reason: optionalString }),
  allowed: anyone,
  async preview(context, params: { reason?: string | null }) {
    const patient = await patientOnScreen(context);
    if (!patient) return NO_PATIENT;
    return { kind: "confirm", action: "add_to_queue", params, title: `Add ${patient.name} to today's queue?`, lines: [...(params.reason ? [{ label: "For", text: params.reason }] : []), { text: "They are marked as arrived and given the next token.", tone: "muted" }] };
  },
  async run(context: RunContext, params: { reason?: string | null }) {
    if (!context.patientId) return NO_PATIENT;
    const res = await context.call("POST", "/api/clinic/appointments/walk-in", { patientId: context.patientId, reason: params.reason ?? undefined });
    if (res.status === 409 && res.body?.appointmentId) return { kind: "done", say: String(res.body.error), to: `/appointments/${res.body.appointmentId}/encounter` };
    if (res.status !== 201) return refusal(res, "They could not be added to the queue.");
    return { kind: "done", say: `In the queue${res.body.tokenNumber != null ? `, token ${res.body.tokenNumber}` : ""}.`, to: `/appointments/${res.body.id}/encounter` };
  },
};

const registerPatient: Action = {
  name: "register_patient",
  summary: "Registers a new patient who has no file here yet. Give their name, and their age, sex and phone number if they were said.",
  kind: "write",
  schema: z.object({
    name: z.string().trim().min(2).max(200),
    age: z.number().int().min(0).max(150).nullable().optional(),
    gender: z.string().max(20).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
  }),
  jsonSchema: strictObject({ name: str, age: optionalNumber, gender: { ...optionalString, description: "Male or Female." }, phone: optionalString }),
  allowed: anyone,
  async preview(_context, params: { name: string; age?: number | null; gender?: string | null; phone?: string | null }) {
    // The commonest way a duplicate file is made is registering someone
    // who is already here. Said before the file is created, not after.
    const digits = (params.phone ?? "").replace(/\D/g, "").slice(-10);
    const same = await prisma.patient.findMany({
      where: { mergedIntoId: null, OR: [{ name: { equals: params.name, mode: "insensitive" } }, ...(digits.length >= 8 ? [{ phone: { contains: digits } }] : [])] },
      select: { id: true, name: true, uhid: true, age: true, phone: true },
      take: 3,
    });
    return {
      kind: "confirm",
      action: "register_patient",
      params,
      title: `Register ${params.name} as a new patient?`,
      lines: [
        { label: "Name", text: params.name },
        ...(params.age != null ? [{ label: "Age", text: String(params.age) }] : []),
        ...(params.gender ? [{ label: "Sex", text: params.gender }] : []),
        ...(params.phone ? [{ label: "Phone", text: params.phone }] : []),
        ...same.map((p): Line => ({ label: "Already here?", text: `${p.name} · ${p.uhid}${p.age != null ? ` · ${p.age}y` : ""}${p.phone ? ` · ${p.phone}` : ""}`, to: `/patients/${p.id}`, tone: "warning" })),
      ],
    };
  },
  async run(context: RunContext, params: { name: string; age?: number | null; gender?: string | null; phone?: string | null }) {
    const res = await context.call("POST", "/api/clinic/patients", { name: params.name, ...(params.age != null ? { age: params.age } : {}), ...(params.gender ? { gender: params.gender } : {}), ...(params.phone ? { phone: params.phone } : {}) });
    if (res.status !== 201) return refusal(res, "The patient could not be registered.");
    return { kind: "done", say: `${params.name} is registered, file number ${res.body.uhid}.`, to: `/patients/${res.body.id}` };
  },
};

export const ACTIONS: Action[] = [
  findPatient, patientBrief, lastPrescription, labResults, visitHistory, visitOnDate, vitalsTrend, patientDues, familyMembers,
  queueSummary, needsAttention, followupsDue, recallList, todaysCollection, assistantUsage,
  openScreen, openNextPatient,
  addFamilyMember, recordVitals, bookVisit, orderTests, writePrescription, addCharge, issueCertificate, addToQueue, registerPatient,
];

/** The actions this person may use in this clinic, right now. */
export function actionsFor(asker: Asker): Action[] {
  return ACTIONS.filter((a) => (!a.module || isFeatureEnabled(a.module)) && a.allowed(asker));
}

export function actionNamed(name: string): Action | undefined {
  return ACTIONS.find((a) => a.name === name);
}
