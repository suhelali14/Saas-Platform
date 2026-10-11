/**
 * One-time setup for a new clinic deployment: creates the singleton Clinic
 * branding row (including its UHID prefix code -- see lib/uhid.ts) and the
 * first DOCTOR login. Deliberately not reachable via any HTTP endpoint --
 * there is no public registration route in this API. Re-running is safe
 * (upserts the clinic + doctor).
 *
 * The medicine database is seeded separately -- see
 * prisma/seed-data/import-drugs.ts (a real ~250k-row dataset, not something
 * this quick setup script should re-run every time).
 *
 * Usage:
 *   CLINIC_SEED_NAME="..." CLINIC_SEED_DOCTOR_NAME="Dr. ..." \
 *   CLINIC_SEED_EMAIL=... CLINIC_SEED_PASSWORD=... CLINIC_SEED_CODE=... \
 *   npx tsx prisma/seed-clinic.ts
 *
 * If env vars are omitted, falls back to obviously-dev values and prints
 * them -- change before this touches anything but a local dev database.
 */
import { PrismaClient } from "../src/generated/prisma-client/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const clinicName = process.env.CLINIC_SEED_NAME || "Demo Clinic";
const doctorName = process.env.CLINIC_SEED_DOCTOR_NAME || "Dr. Demo";
const email = process.env.CLINIC_SEED_EMAIL || "doctor@clinic.local";
const password = process.env.CLINIC_SEED_PASSWORD || "change-me-now-12345";

/** Falls back to the clinic name's initials (e.g. "Wellness Family Clinic" -> "WFC") when no explicit code is set. */
function deriveCode(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials.slice(0, 5) || "PT";
}

const code = process.env.CLINIC_SEED_CODE || deriveCode(clinicName);

// Small, fixed catalog for the lab-order picker -- unlike the drug dataset,
// nowhere near dataset scale, so it's just seeded inline here.
const COMMON_LAB_TESTS: { name: string; normalRange?: string }[] = [
  { name: "Complete Blood Count (CBC)" },
  { name: "Blood Sugar - Fasting", normalRange: "70-100 mg/dL" },
  { name: "Blood Sugar - Postprandial", normalRange: "<140 mg/dL" },
  { name: "HbA1c", normalRange: "<5.7%" },
  { name: "Lipid Profile" },
  { name: "Liver Function Test (LFT)" },
  { name: "Kidney Function Test (KFT)" },
  { name: "Thyroid Profile (T3, T4, TSH)" },
  { name: "Urine Routine & Microscopy" },
  { name: "ESR" },
  { name: "CRP" },
  { name: "Widal Test" },
  { name: "Dengue NS1/IgG/IgM" },
  { name: "Malaria Antigen" },
  { name: "Blood Group & Rh Typing" },
  { name: "Chest X-Ray" },
  { name: "ECG" },
  { name: "Ultrasound Abdomen" },
  { name: "Pregnancy Test (Urine)" },
  { name: "Vitamin D3" },
  { name: "Vitamin B12" },
  { name: "Hemoglobin" },
  { name: "Stool Routine" },
];

async function main() {
  const existingClinic = await prisma.clinic.findFirst();
  const clinic = existingClinic
    ? await prisma.clinic.update({ where: { id: existingClinic.id }, data: { name: clinicName, doctorName, code } })
    : await prisma.clinic.create({ data: { name: clinicName, doctorName, code } });
  console.log(`Clinic ready: ${clinic.name} (UHID prefix: ${clinic.code}, plan gated by CLINIC_PLAN env: ${process.env.CLINIC_PLAN || "BASIC"})`);

  const passwordHash = await bcrypt.hash(password, 10);
  const doctor = await prisma.clinicUser.upsert({
    where: { email },
    update: { passwordHash, name: doctorName, role: "DOCTOR" },
    create: { email, passwordHash, name: doctorName, role: "DOCTOR" },
  });
  console.log(`Doctor login ready: ${doctor.email}`);
  if (!process.env.CLINIC_SEED_PASSWORD) {
    console.log(`No CLINIC_SEED_PASSWORD was set -- using the dev default. Password: ${password}`);
    console.log("Set CLINIC_SEED_* env vars and re-run before this touches anything but a local dev database.");
  }

  const drugCount = await prisma.drug.count();
  if (drugCount === 0) {
    console.log("Drug table is empty -- run `npm run seed:drugs` to import the real medicine database.");
  }

  for (const test of COMMON_LAB_TESTS) {
    await prisma.labTest.upsert({ where: { name: test.name }, update: { normalRange: test.normalRange }, create: test });
  }
  console.log(`Lab test catalog ready (${COMMON_LAB_TESTS.length} tests).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
