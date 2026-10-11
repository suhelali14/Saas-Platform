-- Phase 2: UHID/file-number, encounter-centric linking, multi-doctor
-- appointments, nurse pre-consult vitals, and a real medicine database.
-- Hand-written (not `prisma migrate diff --to-schema-datamodel`) -- that
-- command doesn't connect to the database and renders unqualified table
-- names, which previously produced a bogus full drop-and-recreate diff
-- against this schema-qualified connection. See lib note in an earlier
-- migration for the same reasoning.

-- ── Clinic: branding prefix for UHIDs ───────────────────────────────────
ALTER TABLE "Clinic" ADD COLUMN "code" TEXT;

-- ── Patient: UHID / file number ─────────────────────────────────────────
-- A real Postgres SEQUENCE, not an application-level count+1 -- concurrent
-- reception-desk registrations must never race into the same number.
CREATE SEQUENCE "patient_uhid_seq" START 1;

ALTER TABLE "Patient" ADD COLUMN "uhid" TEXT;
UPDATE "Patient" SET "uhid" = 'PT-' || LPAD(nextval('patient_uhid_seq')::text, 5, '0');
ALTER TABLE "Patient" ALTER COLUMN "uhid" SET NOT NULL;
CREATE UNIQUE INDEX "Patient_uhid_key" ON "Patient"("uhid");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- ── Appointment: multi-doctor assignment + pre-consult vitals ──────────
ALTER TABLE "Appointment" ADD COLUMN "doctorId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "vitals" JSONB;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- ── CaseSheet: the appointmentId column already existed (no FK) -- now a
-- real relation, encounter-centric per the FHIR-Encounter research. ──────
ALTER TABLE "CaseSheet" ADD CONSTRAINT "CaseSheet_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CaseSheet_appointmentId_idx" ON "CaseSheet"("appointmentId");

-- ── Prescription / Certificate: new appointment linkage ────────────────
ALTER TABLE "Prescription" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Prescription_appointmentId_idx" ON "Prescription"("appointmentId");

ALTER TABLE "Certificate" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Certificate_appointmentId_idx" ON "Certificate"("appointmentId");

-- ── Drug: reshaped to match the real dataset's actual fields ───────────
-- Clearing the old 72-row hand-picked MVP seed -- it's about to be replaced
-- by the real ~250k-row dataset (see prisma/seed-data/import-drugs.ts) and
-- those old rows have no composition/manufacturer/packSize data to migrate
-- into the new columns, so mixing them in would just leave confusing
-- mostly-null rows.
TRUNCATE TABLE "Drug";

ALTER TABLE "Drug" ADD COLUMN "composition" TEXT;
ALTER TABLE "Drug" ADD COLUMN "manufacturer" TEXT;
ALTER TABLE "Drug" ADD COLUMN "packSize" TEXT;
ALTER TABLE "Drug" ADD COLUMN "type" TEXT;
ALTER TABLE "Drug" ADD COLUMN "isDiscontinued" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Drug" ADD COLUMN "addedManually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Drug" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Drug" DROP COLUMN "genericName";
ALTER TABLE "Drug" DROP COLUMN "category";

-- Trigram index for fast case-insensitive prefix/substring search across a
-- 250k+ row table -- a plain btree index doesn't serve ILIKE well at this
-- scale, trigram (GIN) indexing is the standard real-world answer.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Drug_name_trgm_idx" ON "Drug" USING GIN ("name" gin_trgm_ops);
