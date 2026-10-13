-- Patient management: the fields a front desk actually asks for, and the
-- two records that make a duplicate survivable.
--
-- Everything is nullable. A patient is registered at a counter with a
-- queue behind them, so the only field that may ever be mandatory is the
-- name -- anything else must be addable later.

-- ── Contact and identity ─────────────────────────────────────────────
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- The question every clinic asks and this could not record. Without it,
-- an unconscious patient's family is reached by looking through a phone.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;

-- Cashless treatment is settled against a TPA, and the policy number is
-- asked for at the counter rather than looked up later.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "insuranceProvider" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "insurancePolicyNumber" TEXT;

-- How they came to the clinic. Clinically useful on a referral, and the
-- only honest answer to "is anything we do bringing patients in".
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;

-- A note for whoever next deals with this person at the desk -- "prefers
-- Marathi", "hard of hearing", "comes with her son". Not clinical: the
-- case sheet is where clinical notes belong.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "deskNote" TEXT;

-- ── Duplicates ───────────────────────────────────────────────────────
--
-- A merged record is kept, not deleted. A prescription printed last year
-- carries the old UHID, and somebody will arrive holding it; the row has
-- to still resolve. Industry guidance is explicit that merges are
-- irreversible and that the old account should be retained for history.
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "mergedById" TEXT;

-- Looking up "has this record been merged away" happens on every patient
-- search, so it is indexed rather than scanned.
CREATE INDEX IF NOT EXISTS "Patient_mergedIntoId_idx" ON "Patient"("mergedIntoId");

-- Duplicate detection matches on phone first, which is the field two
-- registrations of the same person are most likely to share exactly.
CREATE INDEX IF NOT EXISTS "Patient_phone_name_idx" ON "Patient"("phone", "name");
