-- Phase 3: OPD triage priority, analytics support, pharmacy dispensing
-- visibility, doctor follow-up reminders. Hand-written per the established
-- non-interactive migration workflow this session.

-- ── Patient category (triage priority) ──────────────────────────────────
CREATE TYPE "PatientCategory" AS ENUM ('GENERAL', 'PREGNANT', 'SENIOR_CITIZEN', 'CHILD', 'EMERGENCY');
ALTER TABLE "Patient" ADD COLUMN "category" "PatientCategory" NOT NULL DEFAULT 'GENERAL';

-- ── CaseSheet: doctor follow-up reminders ───────────────────────────────
ALTER TABLE "CaseSheet" ADD COLUMN "remindDoctor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaseSheet" ADD COLUMN "reminderResolvedAt" TIMESTAMP(3);

-- ── Prescription: pharmacy/compounder dispensing status ─────────────────
ALTER TABLE "Prescription" ADD COLUMN "dispensed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prescription" ADD COLUMN "dispensedAt" TIMESTAMP(3);
ALTER TABLE "Prescription" ADD COLUMN "dispensedById" TEXT;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_dispensedById_fkey"
  FOREIGN KEY ("dispensedById") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
