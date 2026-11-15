-- Specialty records: the rules the routes check, made database rules, and
-- the earlier versions of corrected records.

-- What a record or episode said before it was corrected or removed.
CREATE TABLE "SpecialtyRevision" (
    "id" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "recordedOn" TIMESTAMP(3),
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialtyRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecialtyRevision_subjectId_idx" ON "SpecialtyRevision"("subjectId");
CREATE INDEX "SpecialtyRevision_patientId_idx" ON "SpecialtyRevision"("patientId");

-- One open pregnancy (or treatment) per patient, and one history of each
-- kind per patient. The routes check both, but a check is a read: two
-- submits at once both pass it. Partial indexes, which schema.prisma cannot
-- express; strip any DROP INDEX a future `prisma migrate diff` offers.
CREATE UNIQUE INDEX IF NOT EXISTS "CareEpisode_one_open_per_kind"
  ON "CareEpisode" ("patientId", "formKey")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "SpecialtyRecord_one_history_per_kind"
  ON "SpecialtyRecord" ("patientId", "formKey")
  WHERE "scope" = 'HISTORY';
