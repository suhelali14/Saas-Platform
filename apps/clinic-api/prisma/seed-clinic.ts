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
/**
 * The lab catalogue, with an indicative adult reference range where a
 * single range is actually the right shape for the test.
 *
 * ── Why many of these are deliberately blank ─────────────────────────
 *
 * Three tests had a range and twenty did not, and nothing displayed the
 * column at all, so the gap was invisible. Now that the range is shown
 * beside the result, the blanks matter -- but filling them all would
 * have been worse than leaving them:
 *
 *   - A PANEL (CBC, Lipid, LFT, KFT, Thyroid, Urine, Stool) reports many
 *     analytes, each with its own range. One string cannot say
 *     "haemoglobin 13-17, platelets 150-410, WBC 4000-11000", and a
 *     single invented figure next to a panel result would be read as
 *     applying to whatever number the clinician is looking at.
 *   - IMAGING and TRACINGS (X-ray, ECG, ultrasound) have no numeric
 *     range. The result is a radiologist's impression.
 *
 * So those stay null and the UI shows nothing, which is honest.
 * QUALITATIVE tests get the expected negative result, because that IS
 * their reference.
 *
 * ── These are defaults, not the clinic's truth ───────────────────────
 *
 * Reference intervals vary by laboratory, method and population, and
 * every real lab report prints its own. These are the widely used adult
 * values, seeded so the field is useful out of the box; the range on the
 * report the patient brings in governs. Sex-dependent ranges carry both,
 * because the alternative is a figure that is wrong for half the
 * patients.
 */
const COMMON_LAB_TESTS: { name: string; normalRange?: string }[] = [
  // Panels -- intentionally no single range. See the note above.
  { name: "Complete Blood Count (CBC)" },
  { name: "Lipid Profile" },
  { name: "Liver Function Test (LFT)" },
  { name: "Kidney Function Test (KFT)" },
  { name: "Thyroid Profile (T3, T4, TSH)" },
  { name: "Urine Routine & Microscopy" },
  { name: "Stool Routine" },

  // Imaging and tracings -- reported as an impression, not a number.
  { name: "Chest X-Ray" },
  { name: "ECG" },
  { name: "Ultrasound Abdomen" },

  // Single-analyte quantitative tests.
  { name: "Blood Sugar - Fasting", normalRange: "70-100 mg/dL" },
  { name: "Blood Sugar - Postprandial", normalRange: "<140 mg/dL" },
  { name: "HbA1c", normalRange: "<5.7%" },
  { name: "Hemoglobin", normalRange: "M 13-17, F 12-15 g/dL" },
  { name: "ESR", normalRange: "M <15, F <20 mm/hr" },
  { name: "CRP", normalRange: "<5 mg/L" },
  { name: "Vitamin D3", normalRange: "30-100 ng/mL" },
  { name: "Vitamin B12", normalRange: "200-900 pg/mL" },

  // Qualitative -- the expected result IS the reference.
  { name: "Widal Test", normalRange: "Negative" },
  { name: "Dengue NS1/IgG/IgM", normalRange: "Negative" },
  { name: "Malaria Antigen", normalRange: "Negative" },
  { name: "Pregnancy Test (Urine)", normalRange: "Negative" },

  // Not a normal/abnormal result at all.
  { name: "Blood Group & Rh Typing" },
];

async function main() {
  // ── This script has to be safe to run twice ────────────────────────
  //
  // It is not only a first-run tool. add-clinic.sh calls it, provisioning
  // is retried when a later step fails, and the catalogue below is how a
  // clinic picks up new reference data. So every write here is now either
  // a create, or an update of something an operator explicitly asked to
  // change. The previous version overwrote three things unconditionally,
  // and each one damaged an established clinic:
  //
  //   - the doctor's password, silently, locking them out of their own
  //     clinic with no message saying why;
  //   - the clinic's name, to "Demo Clinic", whenever the env was unset;
  //   - the UHID prefix, which is embedded in every file number already
  //     issued, leaving two numbering schemes and no way to tell them
  //     apart.
  //
  // None of that is hypothetical: a resumed provisioning run was always
  // one command away from it.
  const existingClinic = await prisma.clinic.findFirst();

  let clinic;
  if (!existingClinic) {
    clinic = await prisma.clinic.create({ data: { name: clinicName, doctorName, code } });
    console.log(`Clinic created: ${clinic.name} (UHID prefix: ${clinic.code})`);
  } else {
    // Only what the operator actually set. The defaults at the top of
    // this file are for a first run against an empty database; applied
    // to a live clinic they are vandalism.
    const data: { name?: string; doctorName?: string; code?: string } = {};
    if (process.env.CLINIC_SEED_NAME) data.name = clinicName;
    if (process.env.CLINIC_SEED_DOCTOR_NAME) data.doctorName = doctorName;

    // The prefix is only changed when asked for BY NAME -- never as a
    // side effect of renaming the clinic -- and never once it is in use.
    if (process.env.CLINIC_SEED_CODE && existingClinic.code !== code) {
      const patients = await prisma.patient.count();
      if (patients > 0) {
        console.log(
          `REFUSING to change the UHID prefix ${existingClinic.code} -> ${code}: ` +
            `${patients} patient(s) already hold file numbers with the old prefix.`,
        );
      } else {
        data.code = code;
      }
    }

    clinic = Object.keys(data).length
      ? await prisma.clinic.update({ where: { id: existingClinic.id }, data })
      : existingClinic;
    const changed = Object.keys(data);
    console.log(
      `Clinic exists: ${clinic.name} (UHID prefix: ${clinic.code})` +
        (changed.length ? ` -- updated ${changed.join(", ")}` : " -- nothing to change"),
    );
  }
  console.log(`  plan gated by CLINIC_PLAN env: ${process.env.CLINIC_PLAN || "BASIC"}`);

  // A password is written on create, or on an explicit reset, and never
  // as a side effect of re-running provisioning.
  const existingDoctor = await prisma.clinicUser.findUnique({ where: { email } });
  const resetRequested = process.env.CLINIC_SEED_RESET_PASSWORD === "1";
  let passwordWritten = false;

  let doctor;
  if (!existingDoctor) {
    doctor = await prisma.clinicUser.create({
      data: { email, passwordHash: await bcrypt.hash(password, 10), name: doctorName, role: "DOCTOR" },
    });
    passwordWritten = true;
    console.log(`Doctor login created: ${doctor.email}`);
  } else {
    doctor = await prisma.clinicUser.update({
      where: { email },
      data: {
        name: doctorName,
        role: "DOCTOR",
        ...(resetRequested ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    passwordWritten = resetRequested;
    if (resetRequested) {
      console.log(`Doctor ${doctor.email}: PASSWORD RESET, because CLINIC_SEED_RESET_PASSWORD=1.`);
    } else {
      console.log(`Doctor ${doctor.email} already existed -- password left alone.`);
      console.log("  To rotate it deliberately: CLINIC_SEED_RESET_PASSWORD=1");
    }
  }

  // Only mention the default when it was actually applied. Printing it
  // after a run that changed nothing is how an operator comes to believe
  // a live clinic's password is "change-me-now-12345".
  if (passwordWritten && !process.env.CLINIC_SEED_PASSWORD) {
    console.log(`No CLINIC_SEED_PASSWORD was set -- used the dev default: ${password}`);
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
