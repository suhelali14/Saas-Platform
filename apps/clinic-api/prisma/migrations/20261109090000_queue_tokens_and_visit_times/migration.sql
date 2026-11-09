-- Token numbers and the times a visit moves through the clinic.
--
-- The queue knew a visit's status but not when it got there, so it could
-- not say how long anyone had been waiting, how long a consultation
-- takes, or roughly when the next patient will be called. Every clinic
-- tool the front desk compares this with shows those three things.
--
-- All four columns are nullable and nothing is backfilled. A visit that
-- was checked in before this migration has no check-in time, and making
-- one up from updatedAt would put a wrong waiting time on the screen.
-- Those rows simply show no time; every visit after the deploy has one.

-- The number on the slip the patient holds, and on the waiting-room
-- screen. One sequence per day for the whole clinic, so no two people
-- in the same waiting room hold the same number even with two doctors.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "tokenNumber" INTEGER;

-- When reception marked them arrived. Waiting time runs from here.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);

-- When the doctor called them in.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

-- When the visit finished. With startedAt, this is how long a
-- consultation took, which is what the estimated wait is made from.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
