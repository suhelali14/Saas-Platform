-- Triage priority moves from the patient to the visit.
--
-- Priority lived only on Patient, set once at registration, and every
-- queue sorted on it. Two of the five values do not describe a person:
-- EMERGENCY describes a visit, and PREGNANT is true for about nine
-- months. Both stayed set forever, so a patient who once arrived bleeding
-- was sorted ahead of everybody on every routine visit afterwards --
-- including ahead of whoever was actually bleeding that morning.
--
-- The order of the three steps below is the whole point. Backfill before
-- demoting, or the history is lost.

-- 1. The visit's own priority. Null means "whatever is usual for this
--    patient", which keeps every existing row meaning what it meant.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "priority" "PatientCategory";

-- 2. Carry the current state onto the appointments it was describing.
--
--    Every existing appointment was being sorted by its patient's
--    category, so writing that category onto the appointment changes
--    nothing about today's queue -- which is the point. A deploy must not
--    reorder a waiting room.
--
--    Only where it is not GENERAL: null already means GENERAL by way of
--    the fallback, and leaving the common case null keeps the column
--    meaningful rather than making it a copy of the patient's.
UPDATE "Appointment" a
   SET "priority" = p."category"
  FROM "Patient" p
 WHERE a."patientId" = p."id"
   AND a."priority" IS NULL
   AND p."category" <> 'GENERAL';

-- 3. Now the patient record can be corrected.
--
--    EMERGENCY and PREGNANT are demoted to GENERAL because they describe
--    a visit, and step 2 has already recorded them on the visits they
--    belonged to. Nothing is lost: the appointments keep their priority,
--    so a past emergency still reads as an emergency, and a future one is
--    stated when it is booked.
--
--    CHILD and SENIOR_CITIZEN are left alone. They are facts about a
--    person and remain a sensible default for the next booking.
--
--    A currently-pregnant patient has to be marked again at her next
--    appointment. That is one action, once, against a field that would
--    otherwise have prioritised her indefinitely after delivery.
UPDATE "Patient"
   SET "category" = 'GENERAL'
 WHERE "category" IN ('EMERGENCY', 'PREGNANT');

-- The queue reads appointments for a given day ordered by time, then
-- re-sorts by tier in the application. The index that matters is already
-- on scheduledAt; priority is read from rows that query has fetched, so
-- it needs no index of its own at clinic scale.
