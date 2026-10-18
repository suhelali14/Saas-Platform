-- Two additions: a free-layout page document, and patient-requested
-- appointments.
--
-- Both are additive and every new column is nullable or defaulted, so an
-- existing clinic keeps serving exactly the page it serves today. That
-- matters more than usual here: there is a live clinic on this schema, and
-- its public website is what its patients see.

-- ── The free-canvas page ───────────────────────────────────────────────
--
-- `publicLayoutMode` is the switch, and it defaults to 'sections' -- the
-- stacked, section-based page every clinic is on now and which is known to
-- work. A clinic only moves to 'canvas' by its own action in the builder.
-- Defaulting the other way would silently republish every existing site
-- through a renderer it has never been tested against.
--
-- `publicCanvas` holds the document: absolutely positioned nodes, with a
-- geometry per breakpoint. It is validated on every write against
-- lib/site-canvas.ts; nothing trusts what is in this column, because it is
-- rendered onto a page served to the public.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "publicLayoutMode" TEXT DEFAULT 'sections';
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "publicCanvas" JSONB;

-- Existing rows predate the column and so have NULL rather than the
-- default. Backfilled explicitly: the renderer treats NULL as 'sections'
-- too, but a column whose meaning depends on remembering that is the kind
-- of thing that breaks the next time someone reads it.
UPDATE "Clinic" SET "publicLayoutMode" = 'sections' WHERE "publicLayoutMode" IS NULL;

-- ── Patient-requested appointments ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'CONFIRMED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "preferredDate" TIMESTAMP(3),
    "preferredSlot" TEXT,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "patientId" TEXT,
    "appointmentId" TEXT,
    "handledById" TEXT,
    "handledByName" TEXT,
    "handledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- The query reception actually runs: the new ones, oldest first, because
-- someone who asked yesterday has been waiting longer.
CREATE INDEX IF NOT EXISTS "AppointmentRequest_status_createdAt_idx"
  ON "AppointmentRequest" ("status", "createdAt");

-- Looking up by phone is how you tell a returning patient from a new one,
-- and how you spot the same person asking three times.
CREATE INDEX IF NOT EXISTS "AppointmentRequest_phone_idx"
  ON "AppointmentRequest" ("phone");

-- SET NULL on all three, never CASCADE. A request is the record that a
-- stranger asked for an appointment; deleting the patient or the
-- appointment it became must not erase the fact that the request happened,
-- or the clinic loses its own trail of who asked and what was done.
DO $$ BEGIN
  ALTER TABLE "AppointmentRequest"
    ADD CONSTRAINT "AppointmentRequest_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AppointmentRequest"
    ADD CONSTRAINT "AppointmentRequest_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AppointmentRequest"
    ADD CONSTRAINT "AppointmentRequest_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
