-- Specialty records: relations, care episodes, filled-in forms, and a
-- clinic's changes to the form library. Additive only.
--
-- prisma migrate diff also offered to drop three hand-made indexes
-- (the trigram drug search and ClinicUser_isActive_idx) and would offer the
-- Admission partial unique indexes; those lines are removed on purpose.

-- CreateEnum
CREATE TYPE "RelationKind" AS ENUM ('SPOUSE', 'PARTNER', 'FATHER', 'MOTHER', 'CHILD', 'SIBLING', 'GUARDIAN', 'OTHER');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecordScope" AS ENUM ('HISTORY', 'VISIT');

-- CreateTable
CREATE TABLE "PatientRelation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" "RelationKind" NOT NULL,
    "relatedPatientId" TEXT,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "phone" TEXT,
    "bloodGroup" TEXT,
    "occupation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareEpisode" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedOn" TIMESTAMP(3) NOT NULL,
    "closedOn" TIMESTAMP(3),
    "partnerId" TEXT,
    "data" JSONB NOT NULL,
    "outcome" JSONB,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "formVersion" INTEGER NOT NULL,
    "scope" "RecordScope" NOT NULL,
    "episodeId" TEXT,
    "appointmentId" TEXT,
    "recordedOn" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicForm" (
    "key" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "definition" JSONB,
    "extraFields" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicForm_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "PatientRelation_patientId_idx" ON "PatientRelation"("patientId");

-- CreateIndex
CREATE INDEX "PatientRelation_relatedPatientId_idx" ON "PatientRelation"("relatedPatientId");

-- CreateIndex
CREATE INDEX "CareEpisode_patientId_status_idx" ON "CareEpisode"("patientId", "status");

-- CreateIndex
CREATE INDEX "CareEpisode_partnerId_idx" ON "CareEpisode"("partnerId");

-- CreateIndex
CREATE INDEX "SpecialtyRecord_patientId_formKey_idx" ON "SpecialtyRecord"("patientId", "formKey");

-- CreateIndex
CREATE INDEX "SpecialtyRecord_episodeId_idx" ON "SpecialtyRecord"("episodeId");

-- CreateIndex
CREATE INDEX "SpecialtyRecord_appointmentId_idx" ON "SpecialtyRecord"("appointmentId");

-- AddForeignKey
ALTER TABLE "PatientRelation" ADD CONSTRAINT "PatientRelation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRelation" ADD CONSTRAINT "PatientRelation_relatedPatientId_fkey" FOREIGN KEY ("relatedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEpisode" ADD CONSTRAINT "CareEpisode_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEpisode" ADD CONSTRAINT "CareEpisode_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PatientRelation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyRecord" ADD CONSTRAINT "SpecialtyRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyRecord" ADD CONSTRAINT "SpecialtyRecord_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "CareEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyRecord" ADD CONSTRAINT "SpecialtyRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
