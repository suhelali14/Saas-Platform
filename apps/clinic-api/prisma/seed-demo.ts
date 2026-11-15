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
const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
/** A time `mins` ago, but never before 7 am today: a demo reset at dawn
 *  must not put patients in the waiting room overnight. */
const ago = (mins: number) => new Date(Math.max(now - mins * MIN, dayStart.getTime() + 7 * 60 * MIN));
const onDay = (daysAgo: number, h: number, m: number) => { const d = new Date(now - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };

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
  { name: "Aarav Kale", age: 7, gender: "Male", phone: "97300 55821", category: "CHILD" },
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
  { name: "Ishaan Kulkarni", age: 4, gender: "Male", phone: "97661 40028", category: "CHILD" },
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
  await today("Fatima Sayyed", 4, { reason: "Antenatal check, 24 weeks", priority: "PREGNANT", doctor: docs.gynae });

  // Booked for later today, and tomorrow.
  const later = (mins: number) => new Date(now + mins * MIN);
  await prisma.appointment.create({ data: { patientId: pt["Priya Shinde"]!, doctorId: docs.gynae, scheduledAt: later(45), reason: "Antenatal check, 10 weeks", priority: "PREGNANT" as never } });
  await prisma.appointment.create({ data: { patientId: pt["Sneha Patil"]!, doctorId: docs.gp, scheduledAt: later(95), reason: "Review after fever" } });
  await prisma.appointment.create({ data: { patientId: pt["Ishaan Kulkarni"]!, doctorId: docs.paeds, scheduledAt: later(130), reason: "Vaccination due" } });
  const tomorrow = new Date(now + DAY); tomorrow.setHours(11, 0, 0, 0);
  await prisma.appointment.create({ data: { patientId: pt["Ramesh Joshi"]!, doctorId: docs.gp, scheduledAt: tomorrow, reason: "Chest X-ray review" } });

  // Two requests from the clinic's website, waiting for reception.
  await prisma.appointmentRequest.createMany({
    data: [
      { name: "Pooja Nair", phone: "98222 10934", preferredDate: tomorrow, preferredSlot: "morning", reason: "Migraine for a week" },
      { name: "Deepak Rao", phone: "97640 88213", preferredDate: tomorrow, preferredSlot: "evening", reason: "Diabetes check-up" },
    ],
  });

  if (RANK >= 1) {
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(10, 0, 0, 0);
    await prisma.expense.createMany({
      data: [
        { category: "Rent", description: "Clinic rent", amount: 45000, paidAt: monthStart, paymentMode: "UPI" as never, recordedById: people.doctor! },
        { category: "Salaries", description: "Staff salaries", amount: 62000, paidAt: monthStart, paymentMode: "UPI" as never, recordedById: people.doctor! },
        { category: "Electricity", description: "MSEDCL bill", amount: 6400, paidAt: new Date(monthStart.getTime() + 4 * DAY), paymentMode: "UPI" as never, recordedById: people.reception! },
        { category: "Pharmacy Stock", description: "Distributor order", amount: 18500, paidAt: new Date(monthStart.getTime() + 6 * DAY), paymentMode: "CASH" as never, recordedById: people.reception! },
      ],
    });
  }

  const logins = Object.keys(people).map((k) => `${k}@${DOMAIN}`);
  console.log(`Demo ready: ${NAMES[PLAN]} (${PLAN}), ${PATIENTS.length} patients, ${token} visits today.`);
  console.log(`Logins (password: ${PASSWORD}): ${logins.join(", ")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
