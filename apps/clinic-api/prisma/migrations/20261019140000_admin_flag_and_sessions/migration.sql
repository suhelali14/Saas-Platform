-- Separate what a staff member IS from what they may ADMINISTER.
--
-- `role` was carrying both questions and got both wrong:
--
--   ADMIN was in CLINICAL_WRITE_ROLES, so a practice manager made ADMIN
--     could write case sheets and prescriptions. An unqualified person
--     issuing a prescription is a regulatory problem, not an untidy one.
--
--   DOCTOR was hardcoded as admin-equivalent everywhere, so every doctor
--     a clinic hired silently received the audit log -- which records who
--     looked at which patient -- plus settings and staff management. The
--     product targets multi-doctor practices, where that is wrong by
--     default.
--
-- A clinic head who is also a doctor is now role DOCTOR with isAdmin
-- true. A non-clinical practice manager is RECEPTIONIST with isAdmin
-- true, and still cannot prescribe.

ALTER TABLE "ClinicUser" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Invalidates every session a user holds, in one write. See lib/sessions.
ALTER TABLE "ClinicUser" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Preserve exactly who can do what today.
--
-- Right now DOCTOR and ADMIN both reach every admin screen, so granting
-- isAdmin to both keeps every existing person's access identical through
-- the deploy. Nobody is locked out of a screen they were using this
-- morning, which is the one thing this migration must not do.
--
-- The change in behaviour is for the NEXT user: a doctor added after this
-- does not get admin unless someone grants it. On the live clinic this
-- promotes exactly one person, the single doctor who is also the owner --
-- which is the arrangement the separation was asked for to express.
UPDATE "ClinicUser" SET "isAdmin" = true WHERE "role" IN ('DOCTOR', 'ADMIN');

-- A clinic with no admin at all would be unable to add staff or reach its
-- own settings, and the only way back would be a hand-written SQL update
-- on a production database. If the statement above matched nobody,
-- promote the oldest active account rather than leaving that trap.
UPDATE "ClinicUser"
   SET "isAdmin" = true
 WHERE "id" = (
   SELECT "id" FROM "ClinicUser"
    WHERE "isActive" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
 )
   AND NOT EXISTS (SELECT 1 FROM "ClinicUser" WHERE "isAdmin" = true);

-- Who may administer is read on every authenticated request.
CREATE INDEX IF NOT EXISTS "ClinicUser_isActive_idx" ON "ClinicUser" ("isActive");
