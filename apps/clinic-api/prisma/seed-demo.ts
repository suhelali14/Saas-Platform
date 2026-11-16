/**
 * Fills a DEMO clinic with a believable day, and wipes it back to that
 * day when run again.
 *
 *   CLINIC_DEMO=1 npx tsx prisma/seed-demo.ts
 *
 * ── It refuses to run on a real clinic ───────────────────────────────
 *
 * This deletes every patient, visit, bill and stock record in the
 * database it is pointed at. So it runs only when CLINIC_DEMO is set in
 * the environment -- which is only ever set in a demo deployment's env
 * file -- and it refuses again if the database holds a clinic whose
 * patients look real: more than 400 of them, or any not created by this
 * script. A script that can empty a database must be impossible to run by
 * mistake against the wrong one.
 *
 * ── What it makes ────────────────────────────────────────────────────
 *
 * Shaped by the plan (CLINIC_PLAN) so a demo shows what that plan sells:
 *
 *   every plan    a doctor, reception, a nurse; fourteen made-up patients
 *                 with past visits (case sheets, prescriptions, lab results,
 *                 bills); today's queue with tokens and real waiting times;
 *                 two booking requests from the website
 *   Polyclinic+   a second doctor, a pharmacist, pharmacy stock (one batch
 *                 near expiry, one running low), this month's expenses
 *   Hospital+     specialists (gynaecology, orthopaedics)
 *
 * Every name is invented. Times are relative to the moment it runs, so
 * "waiting 25 minutes" is true when the demo is opened -- the console's
 * "Reset now" re-runs it right before a meeting.
 */

// Only the TYPE is imported statically; the client itself is loaded below,
// after the environment has been read. Importing the generated client
// loads the project's .env into process.env as a side effect, and imports
// run before any code in this file -- so a static import let a real
// clinic's DATABASE_URL arrive before the check that is meant to refuse
// a missing one.
import type { PrismaClient as PrismaClientType } from "../src/generated/prisma-client/index.js";
import bcrypt from "bcryptjs";
import { compute } from "../src/lib/specialty-forms.js";
import { LIBRARY_BY_KEY } from "../src/lib/specialty-library.js";

const flag = (process.env.CLINIC_DEMO ?? "").toLowerCase();
if (flag !== "1" && flag !== "true") {
  console.error("Refusing: CLINIC_DEMO is not set. This script empties the database and only runs on a demo deployment.");
  process.exit(1);
}

// Every setting is read BEFORE the Prisma client is created. Creating it
// loads a .env file from the project into process.env, and on a
// developer's machine that file belongs to a real clinic: read afterwards,
// its CLINIC_SEED_NAME and CLINIC_PLAN would quietly become the demo's.
const PLAN = (process.env.CLINIC_PLAN ?? "STANDARD") as "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
const RANK = { BASIC: 0, STANDARD: 1, PREMIUM: 2, ENTERPRISE: 3 }[PLAN] ?? 1;
const PASSWORD = process.env.DEMO_PASSWORD || "nayaverse-demo";
const DOMAIN = process.env.DEMO_EMAIL_DOMAIN || "demo.nayaverse.in";
const NAME_OVERRIDE = process.env.DEMO_CLINIC_NAME;
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Refusing: DATABASE_URL is not set in the environment. A demo reset never falls back to a .env file.");
  process.exit(1);
}

const { PrismaClient } = await import("../src/generated/prisma-client/index.js");
const prisma: PrismaClientType = new PrismaClient({ datasources: { db: { url: DB_URL } } });
const MARK = "[demo]"; // in every demo patient's desk note, so a real record is never mistaken for one

const NAMES: Record<typeof PLAN, string> = {
  BASIC: "Sai Clinic",
  STANDARD: "Sai Polyclinic",
  PREMIUM: "Sai Hospital",
  ENTERPRISE: "Sai Multispeciality Hospital",
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const now = Date.now();

/*
 * Clinic time is India's, worked out explicitly rather than from the
 * server's own zone: a container with no TZ runs on UTC, and the 07:30 IST
 * reset is 02:00 there, which put the whole morning queue five hours in
 * the future.
 */
const IST = 330 * MIN;
/** Midnight IST of the day `t` falls on. */
const istMidnight = (t: number) => { const d = new Date(t + IST); d.setUTCHours(0, 0, 0, 0); return d.getTime() - IST; };
/** h:m IST on the day `daysAgo` days back. */
const onDay = (daysAgo: number, h: number, m: number) => new Date(istMidnight(now - daysAgo * DAY) + (h * 60 + m) * MIN);

/*
 * Today's visits are laid out over the last two and a half hours. Before
 * about 9:30 IST there is not that much morning yet, so the timeline is
 * squeezed into however much there is since 7:00 -- in order, each visit
 * still its own moment -- rather than clamped, which put every early
 * visit at the same 7:00.
 */
const MORNING = 160;
const sinceOpen = Math.max(5, (now - (istMidnight(now) + 7 * 60 * MIN)) / MIN);
const squeeze = Math.min(1, sinceOpen / MORNING);
/** A time `mins` ago on the demo's clock. */
const ago = (mins: number) => new Date(now - mins * squeeze * MIN);

async function guard() {
  const total = await prisma.patient.count();
  // Counted as total minus marked, never as "not marked": in SQL, NOT
  // (deskNote LIKE ...) is NULL for a patient with no desk note, so the
  // obvious query skips exactly the real patients -- most of whom have no
  // desk note. That version passed this check against a database full of
  // unmarked patients, and a guard that does that is worse than none.
  const marked = await prisma.patient.count({ where: { deskNote: { contains: MARK } } });
  const real = total - marked;
  if (total > 400 || real > 0) {
    throw new Error(`Refusing: this database has ${total} patients, ${real} of them not made by the demo seed. It does not look like a demo.`);
  }
}

async function wipe() {
  // Children first; every table that refers to a patient or a visit.
  await prisma.specialtyRecord.deleteMany();
  await prisma.careEpisode.deleteMany();
  await prisma.patientRelation.deleteMany();
  await prisma.clinicForm.deleteMany();
  await prisma.nursingEntry.deleteMany();
  await prisma.radiologyOrder.deleteMany();
  await prisma.otBooking.deleteMany();
  await prisma.claimEvent.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.schemePackage.deleteMany();
  await prisma.admissionCharge.deleteMany();
  await prisma.bedMove.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.labOrderItem.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.caseSheetAttachment.deleteMany();
  await prisma.appointmentRequest.deleteMany();
  await prisma.appointment.updateMany({ data: { followUpOfCaseSheetId: null } });
  await prisma.caseSheet.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.counterSession.deleteMany();
  await prisma.departmentMember.deleteMany();
  await prisma.department.deleteMany();
  await prisma.patient.updateMany({ data: { mergedIntoId: null } });
  await prisma.patient.deleteMany();
  await prisma.drugBatch.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.auditLog.deleteMany();
  const schema = new URL(DB_URL!).searchParams.get("schema") || "public";
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "${schema}"."patient_uhid_seq" RESTART WITH 1`);
}

async function staff() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const people = [
    { key: "doctor", name: "Meera Kulkarni", role: "DOCTOR", isAdmin: true, specialization: "General Medicine", qualifications: "MBBS, MD (Medicine)" },
    { key: "reception", name: "Sunita Pawar", role: "RECEPTIONIST", isAdmin: false },
    { key: "nurse", name: "Rekha Shinde", role: "NURSE", isAdmin: false },
    ...(RANK >= 1 ? [
      { key: "doctor2", name: "Arjun Deshpande", role: "DOCTOR", isAdmin: false, specialization: "Paediatrics", qualifications: "MBBS, DCH" },
      { key: "pharmacy", name: "Imran Shaikh", role: "PHARMACIST", isAdmin: false },
    ] : []),
    ...(RANK >= 2 ? [
      { key: "gynae", name: "Anjali Mehta", role: "DOCTOR", isAdmin: false, specialization: "Obstetrics & Gynaecology", qualifications: "MBBS, MS (OBGY)" },
      { key: "ortho", name: "Rohan Joshi", role: "DOCTOR", isAdmin: false, specialization: "Orthopaedics", qualifications: "MBBS, MS (Ortho)" },
      { key: "cashier", name: "Pooja Kale", role: "CASHIER", isAdmin: false },
      { key: "billing", name: "Mahesh Patil", role: "BILLING_CLERK", isAdmin: false },
      { key: "lab", name: "Sameer Khan", role: "LAB_TECH", isAdmin: false },
    ] : []),
    ...(RANK >= 3 ? [
      { key: "radiology", name: "Neha Joshi", role: "RADIOGRAPHER", isAdmin: false },
    ] : []),
  ] as const;
  // Logins not on this plan's list are switched off, not deleted: a
  // demo that was a Hospital and is now a Clinic keeps its history tidy.
  await prisma.clinicUser.updateMany({ where: { email: { endsWith: `@${DOMAIN}` } }, data: { isActive: false } });
  const out: Record<string, string> = {};
  for (const p of people) {
    const email = `${p.key}@${DOMAIN}`;
    const data = {
      name: p.name, role: p.role as never, isAdmin: p.isAdmin, isActive: true, passwordHash: hash,
      specialization: "specialization" in p ? p.specialization : null,
      qualifications: "qualifications" in p ? p.qualifications : null,
      tokenVersion: { increment: 1 },
    };
    const u = await prisma.clinicUser.upsert({
      where: { email },
      update: data,
      create: { ...data, email, tokenVersion: 0 },
    });
    out[p.key] = u.id;
  }
  return out;
}

const PATIENTS = [
  { name: "Ramesh Joshi", age: 64, gender: "Male", phone: "98220 41187", bloodGroup: "B+", allergies: "Penicillin", chronicConditions: "Hypertension, Type 2 diabetes", category: "SENIOR_CITIZEN" },
  { name: "Priya Shinde", age: 29, gender: "Female", phone: "99700 12304", bloodGroup: "O+" },
  { name: "Aarav Kale", age: 7, gender: "Male", phone: "97300 55821", category: "CHILD", dob: new Date("2019-03-12T12:00:00+05:30") },
  { name: "Sneha Patil", age: 41, gender: "Female", phone: "98500 77310", allergies: "Sulfa drugs" },
  { name: "Vikram More", age: 52, gender: "Male", phone: "91580 30219", chronicConditions: "Asthma" },
  { name: "Kavita Gaikwad", age: 36, gender: "Female", phone: "98810 64422" },
  { name: "Sanjay Bhosale", age: 71, gender: "Male", phone: "94220 11893", category: "SENIOR_CITIZEN", chronicConditions: "COPD" },
  { name: "Anita Jadhav", age: 45, gender: "Female", phone: "90110 28816" },
  { name: "Rohit Chavan", age: 24, gender: "Male", phone: "77090 43150" },
  { name: "Meghna Deshmukh", age: 33, gender: "Female", phone: "98600 90215", chronicConditions: "Hypothyroidism" },
  { name: "Nilesh Pawar", age: 48, gender: "Male", phone: "96230 77104" },
  { name: "Fatima Sayyed", age: 31, gender: "Female", phone: "98903 22671" },
  { name: "Ganesh Kamble", age: 58, gender: "Male", phone: "90210 55555", chronicConditions: "Type 2 diabetes" },
  { name: "Ishaan Kulkarni", age: 4, gender: "Male", phone: "97661 40028", category: "CHILD", dob: new Date("2022-07-08T12:00:00+05:30") },
] as const;

async function main() {
  await guard();
  await wipe();
  const people = await staff();
  const docs = { gp: people.doctor!, paeds: people.doctor2 ?? people.doctor!, gynae: people.gynae ?? people.doctor!, ortho: people.ortho ?? people.doctor! };

  await prisma.clinic.updateMany({
    data: {
      name: NAME_OVERRIDE || NAMES[PLAN],
      address: "Shop 4, Lakshmi Road, Pune 411030",
      phone: "020 2445 0000",
      doctorName: "Dr. Meera Kulkarni",
      defaultConsultationFee: 400,
      tagline: "Family medicine and day care, open six days a week.",
    },
  });
  const clinic = await prisma.clinic.findFirst({ select: { code: true } });
  const code = clinic?.code || "DEMO";

  const pt: Record<string, string> = {};
  for (const [i, p] of PATIENTS.entries()) {
    const row = await prisma.patient.create({
      data: {
        ...p,
        category: ("category" in p ? p.category : "GENERAL") as never,
        uhid: `${code}-${String(i + 1).padStart(5, "0")}`,
        deskNote: `${MARK} Made-up patient for the demonstration.`,
        createdAt: new Date(now - (120 - i) * DAY),
      },
    });
    pt[p.name] = row.id;
  }
  const schema = new URL(DB_URL!).searchParams.get("schema") || "public";
  await prisma.$executeRawUnsafe(`SELECT setval('"${schema}"."patient_uhid_seq"', ${PATIENTS.length})`);

  // Pharmacy stock, so the Polyclinic demo has something to dispense from.
  const drugIds: Record<string, string> = {};
  if (RANK >= 1) {
    const stock = [
      { name: "Amlodipine 5mg Tablet", batch: "AML2408", months: 14, qty: 240, threshold: 50 },
      { name: "Metformin 500mg Tablet", batch: "MET2411", months: 9, qty: 30, threshold: 60 }, // running low
      { name: "Paracetamol 650mg Tablet", batch: "PCM2502", months: 1, qty: 400, threshold: 100 }, // near expiry
      { name: "Azithromycin 500mg Tablet", batch: "AZI2409", months: 11, qty: 60, threshold: 20 },
      { name: "Folic Acid 5mg Tablet", batch: "FOL2501", months: 18, qty: 300, threshold: 50 },
    ];
    for (const s of stock) {
      const drug = (await prisma.drug.findFirst({ where: { name: s.name } }))
        ?? (await prisma.drug.create({ data: { name: s.name, type: "Tablet", addedManually: true } }));
      drugIds[s.name] = drug.id;
      const exp = new Date(now); exp.setMonth(exp.getMonth() + s.months);
      await prisma.drugBatch.create({ data: { drugId: drug.id, batchNumber: s.batch, expiryDate: exp, quantityInHand: s.qty, reorderThreshold: s.threshold, costPrice: 1.2 } });
    }
  }

  const rx = (drugName: string, dosage: string, frequency: string, duration: string, instructions?: string) =>
    ({ drugName, dosage, frequency: frequency as never, duration, instructions: instructions ?? null, drugId: drugIds[drugName] ?? null });

  /** One finished visit on a past day, with everything a real one has. */
  async function pastVisit(name: string, daysAgo: number, v: {
    doctor?: string; complaint: string; diagnosis: string; vitals: Record<string, string>;
    items?: ReturnType<typeof rx>[]; labs?: [string, string | null][]; extra?: number; followUpDays?: number;
  }) {
    const arrived = onDay(daysAgo, 10, 5 + (daysAgo * 7) % 40);
    const start = new Date(arrived.getTime() + 14 * MIN);
    const end = new Date(start.getTime() + 11 * MIN);
    const doctorId = v.doctor ?? docs.gp;
    const appt = await prisma.appointment.create({
      data: {
        patientId: pt[name]!, doctorId, scheduledAt: arrived, status: "COMPLETED", reason: v.complaint, vitals: v.vitals,
        tokenNumber: 1 + (daysAgo % 6), checkedInAt: arrived, startedAt: start, completedAt: end, createdAt: arrived,
      },
    });
    const cs = await prisma.caseSheet.create({
      data: {
        patientId: pt[name]!, appointmentId: appt.id, doctorId, chiefComplaint: v.complaint, vitals: v.vitals, diagnosis: v.diagnosis,
        followUpDate: v.followUpDays ? new Date(arrived.getTime() + v.followUpDays * DAY) : null, createdAt: end,
      },
    });
    if (v.items?.length) {
      await prisma.prescription.create({
        data: {
          patientId: pt[name]!, caseSheetId: cs.id, appointmentId: appt.id, doctorId, createdAt: end,
          dispensed: RANK >= 1, dispensedAt: RANK >= 1 ? new Date(end.getTime() + 6 * MIN) : null, dispensedById: RANK >= 1 ? people.pharmacy ?? null : null,
          items: { create: v.items },
        },
      });
    }
    if (v.labs?.length) {
      await prisma.labOrder.create({
        data: {
          patientId: pt[name]!, appointmentId: appt.id, doctorId, createdAt: end,
          status: v.labs.every(([, r]) => r) ? "COMPLETED" : "ORDERED",
          items: { create: v.labs.map(([testName, resultText]) => ({ testName, resultText, completedAt: resultText ? new Date(end.getTime() + 2 * DAY) : null })) },
        },
      });
    }
    const items: { category: "CONSULTATION" | "MEDICINE"; description: string; quantity: number; amount: number }[] = [
      { category: "CONSULTATION", description: "Consultation Fee", quantity: 1, amount: 400 },
    ];
    if (v.extra) items.push({ category: "MEDICINE", description: "Medicines", quantity: 1, amount: v.extra });
    await prisma.invoice.create({
      data: {
        patientId: pt[name]!, appointmentId: appt.id, createdAt: end, items: { create: items },
        payments: { create: [{ amount: 400 + (v.extra ?? 0), mode: (daysAgo % 2 ? "UPI" : "CASH") as never, receivedById: people.reception!, paidAt: new Date(end.getTime() + 3 * MIN) }] },
      },
    });
  }

  const amlo = rx("Amlodipine 5mg Tablet", "1 tab", "OD", "30 days", "After breakfast");
  const metf = rx("Metformin 500mg Tablet", "1 tab", "BD", "30 days", "After meals");
  await pastVisit("Ramesh Joshi", 92, { complaint: "Headache, giddiness in the morning", diagnosis: "Hypertension, uncontrolled", vitals: { bp: "164/98", pulse: "84", weight: "78", spo2: "97", temp: "98.4" }, items: [amlo], labs: [["Lipid Profile", "Total cholesterol 228 mg/dL, LDL 148"], ["Blood Sugar (Fasting)", "142 mg/dL"]], followUpDays: 30 });
  await pastVisit("Ramesh Joshi", 61, { complaint: "Review of BP and sugar", diagnosis: "Hypertension; Type 2 diabetes mellitus", vitals: { bp: "146/90", pulse: "80", weight: "77", spo2: "98", temp: "98.2" }, items: [amlo, metf], labs: [["HbA1c", "7.6 %"]], followUpDays: 45 });
  await pastVisit("Ramesh Joshi", 16, { complaint: "Routine review, mild cough for 3 days", diagnosis: "Hypertension, controlled; acute bronchitis", vitals: { bp: "134/84", pulse: "78", weight: "76", spo2: "97", temp: "99.1" }, items: [amlo, metf, rx("Azithromycin 500mg Tablet", "1 tab", "OD", "3 days", "Not penicillin: patient is allergic")], extra: 120 });
  await pastVisit("Priya Shinde", 23, { doctor: docs.gynae, complaint: "Nausea, missed period", diagnosis: "Early pregnancy, 7 weeks", vitals: { bp: "112/72", pulse: "88", weight: "58", spo2: "99", temp: "98.6" }, items: [rx("Folic Acid 5mg Tablet", "1 tab", "OD", "90 days")], labs: [["CBC", "Hb 11.2 g/dL"], ["Urine Routine", null]], followUpDays: 28 });
  await pastVisit("Vikram More", 40, { complaint: "Breathlessness at night", diagnosis: "Asthma, mild exacerbation", vitals: { bp: "128/82", pulse: "92", weight: "81", spo2: "95", temp: "98.4" }, items: [rx("Budesonide + Formoterol Inhaler", "2 puffs", "BD", "30 days", "Rinse mouth after use")] });
  await pastVisit("Sneha Patil", 8, { complaint: "Fever and body ache for 2 days", diagnosis: "Viral fever", vitals: { bp: "118/76", pulse: "96", weight: "64", spo2: "98", temp: "101.2" }, items: [rx("Paracetamol 650mg Tablet", "1 tab", "TDS", "3 days", "Only if temperature above 100")], labs: [["CBC", "WBC 5,800; platelets 2.1 lakh"]] });
  await pastVisit("Ganesh Kamble", 33, { complaint: "Burning feet, sugar review", diagnosis: "Type 2 diabetes with peripheral neuropathy", vitals: { bp: "138/88", pulse: "76", weight: "84", spo2: "98", temp: "98.3" }, items: [metf], labs: [["HbA1c", "8.4 %"]], followUpDays: 30 });
  await pastVisit("Meghna Deshmukh", 50, { complaint: "Tiredness, weight gain", diagnosis: "Hypothyroidism", vitals: { bp: "120/80", pulse: "64", weight: "69", spo2: "99", temp: "97.9" }, labs: [["Thyroid Profile (T3, T4, TSH)", "TSH 9.8 mIU/L"]] });

  // ── Today ─────────────────────────────────────────────────────────
  let token = 0;
  async function today(name: string, arrivedMinsAgo: number, o: {
    doctor?: string; reason: string; priority?: string; vitals?: Record<string, string>;
    started?: number; ended?: number; diagnosis?: string;
  }) {
    token += 1;
    const arrived = ago(arrivedMinsAgo);
    const status = o.ended !== undefined ? "COMPLETED" : o.started !== undefined ? "IN_PROGRESS" : "CHECKED_IN";
    const appt = await prisma.appointment.create({
      data: {
        patientId: pt[name]!, doctorId: o.doctor ?? docs.gp, scheduledAt: arrived, status: status as never, reason: o.reason,
        priority: (o.priority ?? null) as never, vitals: o.vitals ?? undefined, tokenNumber: token, checkedInAt: arrived,
        startedAt: o.started !== undefined ? ago(o.started) : null, completedAt: o.ended !== undefined ? ago(o.ended) : null,
      },
    });
    if (o.ended !== undefined) {
      await prisma.caseSheet.create({
        data: { patientId: pt[name]!, appointmentId: appt.id, doctorId: o.doctor ?? docs.gp, chiefComplaint: o.reason, diagnosis: o.diagnosis ?? null, vitals: o.vitals ?? undefined, createdAt: ago(o.ended) },
      });
    }
  }
  await today("Anita Jadhav", 150, { reason: "Knee pain", vitals: { bp: "126/80", weight: "70" }, started: 140, ended: 129, diagnosis: "Osteoarthritis, right knee", doctor: docs.ortho });
  await today("Rohit Chavan", 138, { reason: "Sore throat", vitals: { temp: "99.6" }, started: 128, ended: 119, diagnosis: "Acute pharyngitis" });
  await today("Meghna Deshmukh", 121, { reason: "Thyroid follow-up", started: 117, ended: 104, diagnosis: "Hypothyroidism, on treatment" });
  await today("Nilesh Pawar", 96, { reason: "Back pain", doctor: docs.ortho, started: 80, ended: 66, diagnosis: "Mechanical low back pain" });
  await today("Ramesh Joshi", 41, { reason: "Cough not settling", vitals: { bp: "138/86", pulse: "82", spo2: "96", temp: "99.0", weight: "76" }, started: 7 });
  await today("Sanjay Bhosale", 33, { reason: "Breathless since morning", priority: "EMERGENCY", vitals: { spo2: "91", pulse: "108", bp: "150/92" } });
  await today("Kavita Gaikwad", 26, { reason: "Skin rash" });
  await today("Aarav Kale", 18, { reason: "Fever since last night", vitals: { temp: "101.4", weight: "22" }, doctor: docs.paeds });
  await today("Vikram More", 9, { reason: "Inhaler refill" });
  await today("Fatima Sayyed", 4, { reason: "Antenatal check, 39 weeks", priority: "PREGNANT", doctor: docs.gynae });

  // Booked for later today, and tomorrow.
  const later = (mins: number) => new Date(now + mins * MIN);
  await prisma.appointment.create({ data: { patientId: pt["Priya Shinde"]!, doctorId: docs.gynae, scheduledAt: later(45), reason: "Antenatal check, 10 weeks", priority: "PREGNANT" as never } });
  await prisma.appointment.create({ data: { patientId: pt["Sneha Patil"]!, doctorId: docs.gp, scheduledAt: later(95), reason: "Review after fever" } });
  await prisma.appointment.create({ data: { patientId: pt["Ishaan Kulkarni"]!, doctorId: docs.paeds, scheduledAt: later(130), reason: "Vaccination due" } });
  const tomorrow = new Date(istMidnight(now + DAY) + 11 * 60 * MIN); // 11:00 IST tomorrow
  await prisma.appointment.create({ data: { patientId: pt["Ramesh Joshi"]!, doctorId: docs.gp, scheduledAt: tomorrow, reason: "Chest X-ray review" } });

  // Two requests from the clinic's website, waiting for reception.
  await prisma.appointmentRequest.createMany({
    data: [
      { name: "Pooja Nair", phone: "98222 10934", preferredDate: tomorrow, preferredSlot: "morning", reason: "Migraine for a week" },
      { name: "Deepak Rao", phone: "97640 88213", preferredDate: tomorrow, preferredSlot: "evening", reason: "Diabetes check-up" },
    ],
  });

  if (RANK >= 1) {
    // 10:00 IST on the 1st of this month, in India.
    const ist = new Date(now + IST);
    const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 10, 0) - IST);
    await prisma.expense.createMany({
      data: [
        { category: "Rent", description: "Clinic rent", amount: 45000, paidAt: monthStart, paymentMode: "UPI" as never, recordedById: people.doctor! },
        { category: "Salaries", description: "Staff salaries", amount: 62000, paidAt: monthStart, paymentMode: "UPI" as never, recordedById: people.doctor! },
        { category: "Electricity", description: "MSEDCL bill", amount: 6400, paidAt: new Date(monthStart.getTime() + 4 * DAY), paymentMode: "UPI" as never, recordedById: people.reception! },
        { category: "Pharmacy Stock", description: "Distributor order", amount: 18500, paidAt: new Date(monthStart.getTime() + 6 * DAY), paymentMode: "CASH" as never, recordedById: people.reception! },
      ],
    });
  }

  await specialty(pt, docs, people.nurse!);
  if (RANK >= 2) await hospital(people, pt, docs);

  const logins = Object.keys(people).map((k) => `${k}@${DOMAIN}`);
  console.log(`Demo ready: ${NAMES[PLAN]} (${PLAN}), ${PATIENTS.length} patients, ${token} visits today.`);
  console.log(`Logins (password: ${PASSWORD}): ${logins.join(", ")}`);
}

/**
 * A hospital's day: departments, wards, people admitted, a counter open,
 * claims in progress, the theatre list. Hospital plan and up; the scheme
 * desk, radiology and the nursing chart for Multi-specialty.
 *
 * Insurers and TPAs are invented ("Example Health Insurance"), and every
 * scheme package is labelled an example with a made-up rate: a demo must
 * never look like a real rate list someone could copy into a claim.
 */
async function hospital(people: Record<string, string>, pt: Record<string, string>, docs: Record<string, string>) {
  const H = 60 * MIN;
  const name = (k: string) => ({ doctor: "Meera Kulkarni", reception: "Sunita Pawar", nurse: "Rekha Shinde", cashier: "Pooja Kale", billing: "Mahesh Patil" } as Record<string, string>)[k] ?? "Staff";

  // Departments, and who works where.
  const dept = async (n: string, kind: "CLINICAL" | "SERVICE", service: string | null, members: (string | undefined)[], sortOrder: number) =>
    prisma.department.create({
      data: { name: n, kind, service: service as never, sortOrder, members: { create: members.filter(Boolean).map((userId) => ({ userId: userId! })) } },
    });
  const gm = await dept("General Medicine", "CLINICAL", null, [people.doctor], 1);
  await dept("Paediatrics", "CLINICAL", null, [people.doctor2], 2);
  const obgy = await dept("Obstetrics & Gynaecology", "CLINICAL", null, [people.gynae], 3);
  const ortho = await dept("Orthopaedics", "CLINICAL", null, [people.ortho], 4);
  await dept("Front desk", "SERVICE", "FRONT_DESK", [people.reception], 10);
  await dept("Cash counter", "SERVICE", "CASH_COUNTER", [people.cashier, people.reception], 11);
  await dept("Insurance desk", "SERVICE", "INSURANCE", [people.billing], 12);
  if (RANK >= 3) await dept("Scheme desk", "SERVICE", "SCHEMES", [people.billing, people.reception], 13);
  await dept("Pharmacy", "SERVICE", "PHARMACY", [people.pharmacy], 14);
  await dept("Laboratory", "SERVICE", "LAB", [people.lab], 15);
  if (RANK >= 3) await dept("Radiology", "SERVICE", "RADIOLOGY", [people.radiology], 16);
  await dept("Ward A", "SERVICE", "WARD", [people.nurse], 17);
  await dept("Operation theatre", "SERVICE", "OT", [people.nurse, people.ortho, people.gynae], 18);

  // Wards and beds.
  const ward = async (n: string, kind: string, dailyRate: number, prefix: string, beds: number, sortOrder: number) =>
    prisma.ward.create({
      data: { name: n, kind: kind as never, dailyRate, sortOrder, beds: { create: Array.from({ length: beds }, (_, i) => ({ label: `${prefix}-${i + 1}` })) } },
      include: { beds: { orderBy: { label: "asc" } } },
    });
  const general = await ward("General Ward", "GENERAL", 1200, "G", 8, 1);
  const semi = await ward("Semi-private", "SEMI_PRIVATE", 2500, "S", 4, 2);
  const priv = await ward("Private", "PRIVATE", 4000, "P", 3, 3);
  const icu = await ward("ICU", "ICU", 7500, "ICU", 4, 4);
  await prisma.bed.update({ where: { id: general.beds[7]!.id }, data: { blockedReason: "Cleaning" } });

  let ipSeq = 0;
  const schema = new URL(DB_URL!).searchParams.get("schema") || "public";
  async function admit(patient: string, o: {
    hoursAgo: number; bed: { id: string; wardName: string; rate: number }; doctor: string; departmentId: string;
    reason: string; diagnosis: string; payer?: "SELF" | "INSURANCE" | "SCHEME"; estimate?: number;
  }) {
    ipSeq += 1;
    const at = new Date(now - o.hoursAgo * H);
    return prisma.admission.create({
      data: {
        ipNumber: `IP-${new Date(now + IST).getUTCFullYear()}-${String(ipSeq).padStart(5, "0")}`,
        patientId: pt[patient]!, admittingDoctorId: o.doctor, departmentId: o.departmentId, bedId: o.bed.id, admittedAt: at,
        reason: o.reason, provisionalDiagnosis: o.diagnosis, payerType: o.payer ?? "SELF", estimatedCost: o.estimate ?? null,
        moves: { create: [{ bedId: o.bed.id, wardName: o.bed.wardName, dailyRate: o.bed.rate, at, byName: name("reception") }] },
      },
    });
  }
  const bedOf = (w: { name: string; dailyRate: unknown; beds: { id: string }[] }, i: number) => ({ id: w.beds[i]!.id, wardName: w.name, rate: Number(w.dailyRate) });

  const sanjay = await admit("Sanjay Bhosale", { hoursAgo: 3, bed: bedOf(icu, 0), doctor: docs.gp!, departmentId: gm.id, reason: "Breathless, SpO2 91%", diagnosis: "COPD, acute exacerbation", estimate: 60000 });
  const ganesh = await admit("Ganesh Kamble", { hoursAgo: 52, bed: bedOf(general, 2), doctor: docs.gp!, departmentId: gm.id, reason: "Infected foot ulcer", diagnosis: "Diabetic foot, cellulitis", payer: "INSURANCE", estimate: 45000 });
  const fatima = await admit("Fatima Sayyed", { hoursAgo: 30, bed: bedOf(priv, 0), doctor: docs.gynae!, departmentId: obgy.id, reason: "Term pregnancy, labour pains", diagnosis: "Term pregnancy, previous LSCS", payer: RANK >= 3 ? "SCHEME" : "SELF", estimate: 55000 });
  const anita = await admit("Anita Jadhav", { hoursAgo: 4, bed: bedOf(semi, 1), doctor: docs.ortho!, departmentId: ortho.id, reason: "Planned knee replacement", diagnosis: "Osteoarthritis, right knee", estimate: 180000 });
  // Moved out of ICU after the first night: two wards on one bill.
  await prisma.bedMove.create({ data: { admissionId: ganesh.id, bedId: general.beds[2]!.id, wardName: "General Ward", dailyRate: 1200, at: new Date(now - 30 * H), byName: name("nurse") } });
  await prisma.bedMove.updateMany({ where: { admissionId: ganesh.id, at: { lt: new Date(now - 40 * H) } }, data: { wardName: "ICU", dailyRate: 7500 } });

  const charge = (admissionId: string, category: string, description: string, rate: number, quantity = 1, hoursAgo = 1) =>
    prisma.admissionCharge.create({ data: { admissionId, category: category as never, description, rate, quantity, at: new Date(now - hoursAgo * H), byName: name("nurse") } });
  await charge(sanjay.id, "DOCTOR_VISIT", "Physician visit", 800, 1, 2);
  await charge(sanjay.id, "PROCEDURE", "Nebulisation", 300, 3, 1);
  await charge(sanjay.id, "LAB", "Arterial blood gas", 1200, 1, 2);
  await charge(ganesh.id, "DOCTOR_VISIT", "Physician visit", 800, 3, 10);
  await charge(ganesh.id, "PROCEDURE", "Wound debridement and dressing", 3500, 1, 40);
  await charge(ganesh.id, "MEDICINE", "IV antibiotics (Ceftriaxone)", 450, 4, 8);
  await charge(ganesh.id, "LAB", "Pus culture and sensitivity", 900, 1, 45);
  await charge(fatima.id, "OT", "Caesarean section: theatre and surgeon", 28000, 1, 20);
  await charge(fatima.id, "NURSING", "Nursing care", 600, 2, 6);
  await charge(anita.id, "LAB", "Pre-operative profile", 2400, 1, 3);

  // The cash counter: open, with today's advances on it.
  const session = await prisma.counterSession.create({
    data: { counterName: "Counter 1", openedById: people.cashier!, openedByName: name("cashier"), openedAt: new Date(now - 5 * H), openingCash: 5000 },
  });
  const deposit = (patient: string, admissionId: string, amount: number, mode: string, hoursAgo: number, onCounter = true) =>
    prisma.deposit.create({
      data: { patientId: pt[patient]!, admissionId, kind: "ADVANCE", amount, mode: mode as never, byId: people.cashier!, byName: name("cashier"), at: new Date(now - hoursAgo * H), counterSessionId: onCounter ? session.id : null },
    });
  await deposit("Sanjay Bhosale", sanjay.id, 20000, "CASH", 2.5);
  await deposit("Anita Jadhav", anita.id, 50000, "UPI", 3.5);
  await deposit("Ganesh Kamble", ganesh.id, 10000, "CARD", 50, false);
  await deposit("Fatima Sayyed", fatima.id, 5000, "CASH", 29, false);

  // A discount over the limit, waiting for the admin.
  // Discounts above ₹200 need the admin; this one is ₹300 on a ₹520 bill.
  await prisma.clinic.updateMany({ data: { discountApprovalAbove: 200 } });
  const anyBill = await prisma.invoice.findFirst({ where: { patientId: pt["Ramesh Joshi"]! }, orderBy: { createdAt: "desc" } });
  if (anyBill) {
    // Asked for before he paid, as it is at a real counter: a discount
    // cannot be approved on a bill already paid in full (the money would
    // have to come back as a refund), so this bill is left unpaid.
    await prisma.payment.deleteMany({ where: { invoiceId: anyBill.id } });
    await prisma.invoice.update({ where: { id: anyBill.id }, data: { discount: 300, discountReason: "Senior citizen, long-standing patient", discountStatus: "PENDING", discountRequestedBy: name("reception") } });
  }

  // An insurance claim in progress.
  await prisma.claim.create({
    data: {
      admissionId: ganesh.id, patientId: pt["Ganesh Kamble"]!, payer: "INSURANCE", payerName: "Example Health Insurance, via Example TPA", memberId: "EXH-2291-0045",
      preauthStatus: "APPROVED", preauthNumber: "PA-778812", preauthAmount: 40000, preauthApprovedAt: new Date(now - 46 * H), preauthValidTill: new Date(now + 10 * 24 * H),
      claimStatus: "NOT_SUBMITTED",
      documents: [
        { name: "Pre-authorisation form, signed", done: true }, { name: "Policy card and photo ID", done: true },
        { name: "Doctor's notes and investigation reports", done: true }, { name: "Final bill with break-up", done: false },
        { name: "Discharge summary", done: false }, { name: "Pharmacy bills", done: false },
      ],
      events: { create: [
        { byName: name("billing"), what: "Claim opened", at: new Date(now - 50 * H) },
        { byName: name("billing"), what: "Pre-auth submitted", at: new Date(now - 49 * H) },
        { byName: name("billing"), what: "Pre-auth approved", note: "₹40,000 approved by the TPA", at: new Date(now - 46 * H) },
      ] },
    },
  });
  // And an older one, settled with a deduction, for the ageing view.
  await prisma.claim.create({
    data: {
      patientId: pt["Nilesh Pawar"]!, payer: "INSURANCE", payerName: "Example General Insurance", memberId: "EGI-55-10293",
      preauthStatus: "APPROVED", preauthAmount: 35000, claimStatus: "SUBMITTED", claimAmount: 32800, claimSubmittedAt: new Date(now - 41 * 24 * H),
      documents: [{ name: "Final bill with break-up", done: true }, { name: "Discharge summary", done: true }],
      events: { create: [{ byName: name("billing"), what: "Claim submitted", at: new Date(now - 41 * 24 * H) }] },
    },
  });

  // The theatre: today and tomorrow.
  const ot = (patient: string, o: { admissionId?: string; surgeon: string; theatre: string; procedure: string; at: Date; mins: number; status?: string; notes?: string }) =>
    prisma.otBooking.create({
      data: {
        patientId: pt[patient]!, admissionId: o.admissionId ?? null, surgeonId: o.surgeon, theatre: o.theatre, procedure: o.procedure, scheduledAt: o.at, durationMins: o.mins,
        status: (o.status ?? "SCHEDULED") as never, anaesthetist: "Dr. Kiran Bapat", anaesthesiaType: o.procedure.includes("Caesarean") ? "Spinal" : "General",
        operationNotes: o.notes ?? null, startedAt: o.status === "DONE" ? o.at : null, endedAt: o.status === "DONE" ? new Date(o.at.getTime() + o.mins * MIN) : null,
      },
    });
  await ot("Fatima Sayyed", { admissionId: fatima.id, surgeon: docs.gynae!, theatre: "OT 1", procedure: "Lower segment Caesarean section", at: new Date(now - 22 * H), mins: 60, status: "DONE", notes: "Healthy baby girl, 2.9 kg. Uneventful." });
  await ot("Anita Jadhav", { admissionId: anita.id, surgeon: docs.ortho!, theatre: "OT 1", procedure: "Total knee replacement, right", at: onDay(-1, 9, 30), mins: 150 });
  await ot("Rohit Chavan", { surgeon: docs.ortho!, theatre: "OT 2", procedure: "Removal of implant, left wrist", at: onDay(0, 16, 0), mins: 45 });

  if (RANK >= 3) {
    // The scheme desk: example packages, plainly labelled, and a claim.
    const pkg = await prisma.schemePackage.create({
      data: {
        scheme: "MJPJAY", code: "EX-OBG-01", name: "Caesarean section (example; load your scheme's current list)", rate: 30000,
        documents: ["Ration card / scheme card and photo ID", "Arogyamitra registration", "Pre-op USG report", "Discharge summary", "Baby's birth record"],
      },
    });
    await prisma.schemePackage.create({ data: { scheme: "PMJAY", code: "EX-MED-01", name: "Acute exacerbation of COPD (example)", rate: 18000, documents: ["Beneficiary verification (BIS) and e-card", "Photo of the patient in the bed", "Chest X-ray", "ABG report"] } });
    await prisma.schemePackage.create({ data: { scheme: "PMJAY", code: "EX-ORT-01", name: "Total knee replacement (example)", rate: 80000, documents: ["Beneficiary verification (BIS) and e-card", "Implant invoice and sticker", "Pre and post-op X-ray"] } });
    await prisma.claim.create({
      data: {
        admissionId: fatima.id, patientId: pt["Fatima Sayyed"]!, payer: "SCHEME", payerName: "MJPJAY", scheme: "MJPJAY", memberId: "MH-27-55102938",
        packageCode: pkg.code, packageName: pkg.name, packageRate: pkg.rate,
        preauthStatus: "QUERY", preauthNumber: "MJP/PA/0091", claimStatus: "NOT_SUBMITTED",
        documents: [
          { name: "Ration card / scheme card and photo ID", done: true }, { name: "Arogyamitra registration", done: true },
          { name: "Pre-op USG report", done: false }, { name: "Discharge summary", done: false }, { name: "Baby's birth record", done: false },
        ],
        events: { create: [
          { byName: name("billing"), what: "Claim opened", at: new Date(now - 29 * H) },
          { byName: name("billing"), what: "Pre-auth submitted", at: new Date(now - 28 * H) },
          { byName: name("billing"), what: "Pre-auth query raised", note: "Insurer asks for the pre-op USG report", at: new Date(now - 6 * H) },
        ] },
      },
    });

    // Radiology worklist.
    await prisma.radiologyOrder.create({ data: { patientId: pt["Sanjay Bhosale"]!, admissionId: sanjay.id, orderedById: docs.gp, modality: "XRAY", study: "Chest X-ray PA view", clinicalNotes: "Breathless, ?consolidation", status: "DONE", doneAt: new Date(now - 1.5 * H), createdAt: new Date(now - 2.5 * H) } });
    await prisma.radiologyOrder.create({ data: { patientId: pt["Priya Shinde"]!, orderedById: docs.gynae, modality: "USG", study: "Obstetric ultrasound, 10 weeks", status: "ORDERED", createdAt: new Date(now - 0.5 * H) } });
    await prisma.radiologyOrder.create({ data: { patientId: pt["Anita Jadhav"]!, admissionId: anita.id, orderedById: docs.ortho, modality: "XRAY", study: "X-ray right knee, AP and lateral", status: "REPORTED", doneAt: new Date(now - 3 * H), reportedAt: new Date(now - 2 * H), reportedByName: "Neha Joshi", report: "Reduced medial joint space with osteophytes. Subchondral sclerosis.", impression: "Advanced osteoarthritis, right knee.", createdAt: new Date(now - 3.5 * H) } });

    // The ward chart.
    const chart = (admissionId: string, kind: string, hoursAgo: number, extra: Record<string, unknown>) =>
      prisma.nursingEntry.create({ data: { admissionId, kind: kind as never, at: new Date(now - hoursAgo * H), byName: name("nurse"), ...extra } });
    await chart(sanjay.id, "VITALS", 2.8, { vitals: { bp: "150/92", pulse: "108", spo2: "91", rr: "28", temp: "99.2" } });
    await chart(sanjay.id, "MEDICATION", 2.5, { drugName: "Salbutamol + Ipratropium", dose: "1 respule", route: "Nebulised" });
    await chart(sanjay.id, "VITALS", 1, { vitals: { bp: "138/86", pulse: "96", spo2: "94", rr: "22", temp: "98.8" } });
    await chart(sanjay.id, "NOTE", 0.8, { note: "Breathing easier after nebulisation. On 2 L oxygen. Family informed." });
    await chart(ganesh.id, "VITALS", 6, { vitals: { bp: "136/84", pulse: "82", temp: "99.4", sugar: "212" } });
    await chart(ganesh.id, "MEDICATION", 5, { drugName: "Ceftriaxone", dose: "1 g", route: "IV" });
    await chart(fatima.id, "VITALS", 3, { vitals: { bp: "118/76", pulse: "84", temp: "98.6", pain: "3" } });
    await chart(fatima.id, "NOTE", 2, { note: "Mother and baby well. Breastfeeding established. Mobilised to chair." });
  }
  await prisma.$executeRawUnsafe(`SELECT setval('"${schema}"."ip_number_seq"', ${ipSeq})`).catch(() => undefined);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });

/**
 * Specialty records, in every plan: Priya ten weeks into her second
 * pregnancy with her husband linked; Fatima's antenatal card to term after
 * a previous caesarean; a couple in fertility treatment, both partners on
 * the record; a toddler's growth, birth history and vaccines; Ramesh's
 * diabetes reviews; an eye examination; a gynaecology visit.
 */
async function specialty(pt: Record<string, string>, docs: { gp: string; paeds: string; gynae: string; ortho: string }, nurse: string) {
  const users = await prisma.clinicUser.findMany({ select: { id: true, name: true } });
  const who = (id: string) => users.find((u) => u.id === id)?.name ?? "Staff";
  const day = (daysAgo: number) => new Date(istMidnight(now - daysAgo * DAY) + 12 * 60 * MIN).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
  const form = (k: string) => LIBRARY_BY_KEY.get(k)!;
  const patientOf = async (id: string) => (await prisma.patient.findUnique({ where: { id }, select: { age: true, dob: true } })) ?? undefined;

  async function relation(patient: string, kind: string, r: { name: string; age?: number; gender?: string; bloodGroup?: string; occupation?: string; phone?: string; relatedPatientId?: string }) {
    return prisma.patientRelation.create({ data: { patientId: pt[patient]!, kind: kind as never, ...r } });
  }
  async function episode(patient: string, key: string, startedAgo: number, data: Record<string, unknown>, by: string, partnerId?: string) {
    const def = form(key);
    const filled = compute(def.sections, data, { recordedOn: day(startedAgo), patient: await patientOf(pt[patient]!) });
    return prisma.careEpisode.create({
      data: { patientId: pt[patient]!, formKey: key, formVersion: def.version, startedOn: noon(key === "pregnancy" && typeof data.lmp === "string" ? data.lmp : day(startedAgo)), partnerId: partnerId ?? null, data: filled as never, createdById: by, createdByName: who(by), createdAt: noon(day(startedAgo)) },
    });
  }
  async function record(patient: string, key: string, daysAgo: number, data: Record<string, unknown>, by: string, ep?: { id: string; data: unknown }) {
    const def = form(key);
    const filled = compute(def.sections, data, { recordedOn: day(daysAgo), episode: ep?.data as Record<string, unknown> | undefined, patient: await patientOf(pt[patient]!) });
    return prisma.specialtyRecord.create({
      data: {
        patientId: pt[patient]!, formKey: key, formVersion: def.version, scope: def.kind === "history" ? "HISTORY" : "VISIT",
        episodeId: ep?.id ?? null, recordedOn: noon(day(daysAgo)), data: filled as never, recordedById: by, recordedByName: who(by), createdAt: noon(day(daysAgo)),
      },
    });
  }

  // Priya: second pregnancy, ten weeks.
  const amit = await relation("Priya Shinde", "SPOUSE", { name: "Amit Shinde", age: 32, gender: "Male", bloodGroup: "B+", occupation: "School teacher", phone: "99700 12399" });
  const priya = await episode("Priya Shinde", "pregnancy", 28, {
    lmp: day(72), conception: "Naturally", gravida: 2, para: 1, living: 1, abortions: 0,
    past: [{ year: 2023, outcome: "Normal delivery", weeks: 39, weight: 3.0 }],
    pre_weight: 54, height: 158, consanguinity: false, high_risk: false,
  }, docs.gynae, amit.id);
  // Booked at six weeks: 72 days since the LMP, less 28.
  await record("Priya Shinde", "antenatal", 28, {
    complaints: ["Vomiting"], weight: 54.5, bp_systolic: 108, bp_diastolic: 70, pulse: 84, pallor: "None", oedema: "None",
    presentation: "Not yet palpable", hb: 11.2, urine_albumin: "Nil", urine_sugar: "Nil",
    usg: "Single live intrauterine pregnancy, size matches 6 weeks.", ifa: true, td: "None today",
    advice: "Small frequent meals. Folic acid daily.", next_visit: day(2),
  }, docs.gynae, priya);
  await record("Priya Shinde", "antenatal", 2, {
    complaints: ["None"], weight: 55, bp_systolic: 110, bp_diastolic: 72, pulse: 82, pallor: "None", oedema: "None",
    presentation: "Not yet palpable", urine_albumin: "Nil", urine_sugar: "Nil", ifa: true, td: "None today",
    advice: "Dating and NT scan between 11 and 13 weeks.", next_visit: day(-26),
  }, nurse, priya);

  // Fatima: to term after a caesarean, every antenatal visit on the card.
  const salim = await relation("Fatima Sayyed", "SPOUSE", { name: "Salim Sayyed", age: 35, gender: "Male", bloodGroup: "A+", occupation: "Shopkeeper", phone: "98903 22600" });
  const lmpAgo = 39 * 7 + 1;
  const fatima = await episode("Fatima Sayyed", "pregnancy", lmpAgo - 12 * 7, {
    lmp: day(lmpAgo), conception: "Naturally", gravida: 2, para: 1, living: 1, abortions: 0,
    past: [{ year: 2022, outcome: "Caesarean (LSCS)", weeks: 38, weight: 2.9, notes: "Failed induction" }],
    pre_weight: 57, height: 152, risks: ["Previous caesarean"], high_risk: true,
    risk_notes: "Planned repeat caesarean at 39 weeks. Watch for scar tenderness.",
  }, docs.gynae, salim.id);
  const anc: [number, Record<string, unknown>][] = [
    [12, { weight: 57.5, bp_systolic: 106, bp_diastolic: 68, presentation: "Not yet palpable", hb: 10.6, urine_albumin: "Nil", urine_sugar: "Nil", ifa: true, usg: "Single live fetus, NT normal." }],
    [20, { weight: 60, bp_systolic: 110, bp_diastolic: 70, fundal_height: 20, fhr: 148, movements: "Felt well", hb: 10.9, urine_albumin: "Nil", urine_sugar: "Nil", td: "Td 1", ifa: true, calcium: true, usg: "Anomaly scan normal. Placenta upper segment, posterior." }],
    [26, { weight: 63, bp_systolic: 112, bp_diastolic: 72, fundal_height: 26, fhr: 146, movements: "Felt well", hb: 11.2, urine_albumin: "Nil", urine_sugar: "Nil", td: "Td 2", ifa: true, calcium: true, other_tests: "OGTT normal" }],
    [30, { weight: 65.5, bp_systolic: 114, bp_diastolic: 74, fundal_height: 30, presentation: "Cephalic", fhr: 144, movements: "Felt well", hb: 11.5, urine_albumin: "Nil", urine_sugar: "Nil", ifa: true, calcium: true }],
    [34, { weight: 67.5, bp_systolic: 118, bp_diastolic: 76, fundal_height: 33, presentation: "Cephalic", fhr: 142, movements: "Felt well", oedema: "Feet", hb: 11.6, urine_albumin: "Trace", urine_sugar: "Nil", ifa: true, calcium: true, advice: "Rest with feet up. Report headache or blurred vision at once." }],
    [37, { weight: 69, bp_systolic: 120, bp_diastolic: 78, fundal_height: 36, presentation: "Cephalic", fhr: 140, movements: "Felt well", oedema: "Feet", hb: 11.8, urine_albumin: "Nil", urine_sugar: "Nil", ifa: true }],
    [38, { weight: 69.5, bp_systolic: 122, bp_diastolic: 80, fundal_height: 37, presentation: "Cephalic", fhr: 142, movements: "Felt well", oedema: "Feet", urine_albumin: "Nil", urine_sugar: "Nil", advice: "Admit at 39 weeks for planned caesarean." }],
  ];
  for (const [weeks, d] of anc) {
    await record("Fatima Sayyed", "antenatal", lmpAgo - weeks * 7, { complaints: ["None"], pallor: weeks < 26 ? "Mild" : "None", pulse: 86, ...d }, weeks % 2 ? nurse : docs.gynae, fatima);
  }

  // A couple in fertility treatment: the wife's record, the husband linked.
  const rahul = await relation("Meghna Deshmukh", "SPOUSE", { name: "Rahul Deshmukh", age: 36, gender: "Male", bloodGroup: "O+", occupation: "Software engineer", phone: "98600 90299" });
  await record("Meghna Deshmukh", "menstrual", 60, {
    menarche: 13, regularity: "Irregular", cycle_length: 42, period_days: 5, flow: "Normal", pain: "Mild",
    intermenstrual: false, postcoital: false, lmp: day(12), contraception: "None",
  }, docs.gynae);
  const ivf = await episode("Meghna Deshmukh", "infertility", 60, {
    treated: "Both", type: "Primary (never conceived)", married_years: 6, trying_years: 4, frequency: "2–3 times a week", consanguinity: false,
    f_cycles: "Irregular", f_pcos: true, f_amh: 4.8, f_tsh: 2.1, f_prolactin: 14, f_hsg: "Both open",
    f_previous: "Clomiphene for three cycles in 2025, no pregnancy.",
    m_habits: ["Smoking"], m_conditions: "None known", plan: "Ovulation induction",
    plan_notes: "Letrozole 2.5 mg, days 3–7. Follicle scans from day 9. Husband to stop smoking; repeat semen analysis in three months.",
  }, docs.gynae, rahul.id);
  await record("Meghna Deshmukh", "semen_analysis", 55, { abstinence: 3, volume: 2.4, count: 11, motility: 28, morphology: 3, impression: "Low count (oligozoospermia)", notes: "Counselled on smoking." }, docs.gynae, ivf);
  await record("Meghna Deshmukh", "follicular", 3, {
    cycle_lmp: day(12), drug: "Letrozole 2.5 mg, days 3–7", endometrium: 6.8, pattern: "Trilaminar",
    follicles: [{ row: "Right ovary", count: 2, largest: 13, sizes: "13, 10" }, { row: "Left ovary", count: 1, largest: 11, sizes: "11" }],
    trigger: false, procedure: "Nothing",
  }, docs.gynae, ivf);
  await record("Meghna Deshmukh", "follicular", 1, {
    cycle_lmp: day(12), drug: "Letrozole 2.5 mg, days 3–7", endometrium: 8.4, pattern: "Trilaminar",
    follicles: [{ row: "Right ovary", count: 2, largest: 17.5, sizes: "17.5, 12" }, { row: "Left ovary", count: 1, largest: 13, sizes: "13" }],
    trigger: false, procedure: "Nothing", notes: "Scan again in two days; trigger expected at 18–20 mm.",
  }, docs.gynae, ivf);

  // Ishaan, four: birth history, vaccines to date, growth over a year.
  await relation("Ishaan Kulkarni", "MOTHER", { name: "Shruti Kulkarni", age: 31, gender: "Female", bloodGroup: "B+", occupation: "Pharmacist", phone: "97661 40000" });
  const dob = (await patientOf(pt["Ishaan Kulkarni"]!))?.dob;
  const after = (days: number) => (dob ? new Date(dob.getTime() + days * DAY).toISOString().slice(0, 10) : day(0));
  await record("Ishaan Kulkarni", "birth_history", 300, { birth_weight: 2.9, gestation: 38, delivery: "Caesarean", cried: true, nicu: false, jaundice: true, mother: "Gestational diabetes, diet-controlled." }, docs.paeds);
  const given = (label: string, days: number) => ({ row: label, given_on: after(days) });
  await record("Ishaan Kulkarni", "immunisation", 30, {
    doses: [
      given("BCG (birth)", 0), given("OPV 0 (birth)", 0), given("Hep B 1 (birth)", 0),
      ...["DTwP/DTaP 1 (6 wk)", "IPV 1 (6 wk)", "Hib 1 (6 wk)", "Hep B 2 (6 wk)", "Rotavirus 1 (6 wk)", "PCV 1 (6 wk)"].map((v) => given(v, 42)),
      ...["DTwP/DTaP 2 (10 wk)", "IPV 2 (10 wk)", "Hib 2 (10 wk)", "Hep B 3 (10 wk)", "Rotavirus 2 (10 wk)", "PCV 2 (10 wk)"].map((v) => given(v, 70)),
      ...["DTwP/DTaP 3 (14 wk)", "IPV 3 (14 wk)", "Hib 3 (14 wk)", "Hep B 4 (14 wk)", "Rotavirus 3 (14 wk)", "PCV 3 (14 wk)"].map((v) => given(v, 98)),
      given("Influenza 1 (6 mo)", 183), given("Influenza 2 (7 mo)", 213), given("Typhoid conjugate (6–9 mo)", 240), given("MMR 1 (9 mo)", 274),
      given("Hep A 1 (12 mo)", 366), given("PCV booster (12–15 mo)", 400), given("MMR 2 (15 mo)", 457), given("Varicella 1 (15 mo)", 457),
      given("DTwP/DTaP booster 1 (16–18 mo)", 500), given("Hib booster (16–18 mo)", 500), given("IPV booster (16–18 mo)", 500), given("Hep A 2 (18 mo)", 548),
      given("Varicella 2 (3–4 yr)", 1150),
    ],
  }, nurse);
  for (const [ago, w, h] of [[365, 13.1, 92.5], [180, 14.2, 97], [30, 15.4, 101.5]] as const) {
    await record("Ishaan Kulkarni", "child_growth", ago, { weight: w, height: h, milestones: "As expected for age", feeding: "Family food", advice: ago === 30 ? "DTaP and MMR boosters due at 4–6 years." : undefined }, docs.paeds);
  }

  // Ramesh: diabetes reviews over six months.
  for (const [ago, fbs, ppbs, a1c, w, s, dia] of [[180, 168, 240, 8.4, 82, 146, 90], [90, 142, 205, 7.6, 80.5, 138, 86], [3, 128, 182, 7.1, 79, 132, 84]] as const) {
    await record("Ramesh Joshi", "diabetes_review", ago, {
      fbs, ppbs, hba1c: a1c, weight: w, bp_systolic: s, bp_diastolic: dia, feet: "Normal", hypos: false,
      adherence: ago === 180 ? "Missed some" : "As advised", eye_check: day(200), creatinine: 1.1,
    }, docs.gp);
  }

  // An eye examination and a gynaecology visit.
  await record("Vikram More", "eye_exam", 20, {
    vision: [{ row: "Right eye", unaided: "6/9", glasses: "6/6", near: "N10" }, { row: "Left eye", unaided: "6/9", glasses: "6/6", near: "N10" }],
    refraction: [{ row: "Right eye", sph: 0.5, add: 2 }, { row: "Left eye", sph: 0.25, cyl: -0.5, axis: 90, add: 2 }],
    iop: [{ row: "Right eye", iop: 16 }, { row: "Left eye", iop: 17 }],
    anterior: "Clear lens, quiet anterior chamber.", fundus: "Normal disc and macula.", diagnosis: "Presbyopia", advice: "Reading glasses; review in a year.",
  }, docs.gp);
  await record("Anita Jadhav", "menstrual", 20, { menarche: 12, regularity: "Regular", cycle_length: 26, period_days: 7, flow: "Heavy with clots", pain: "Moderate", lmp: day(20), contraception: "Tubectomy" }, docs.gynae);
  await record("Anita Jadhav", "gynae_visit", 20, {
    lmp: day(20), complaints: ["Heavy periods", "Pain in the lower abdomen"], upt: "Negative", abdomen: "Soft, no mass felt",
    pv: "Uterus bulky, about 8 weeks size", usg: "Bulky uterus with a 2.5 cm intramural fibroid. Ovaries normal.", notes: "Hb and thyroid tests; review with reports.",
  }, docs.gynae);
}
