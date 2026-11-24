-- The clinic assistant's working record of a consultation: what it heard,
-- what it proposed, and what the doctor confirmed. No audio is stored.
--
-- No foreign keys on purpose (see the model's note in schema.prisma): a
-- merged patient or a removed appointment must neither cascade into this
-- nor be blocked by it.

CREATE TYPE "ScribeStatus" AS ENUM ('OPEN', 'DRAFTED', 'CONFIRMED', 'DISCARDED');

CREATE TABLE "ScribeSession" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "status" "ScribeStatus" NOT NULL DEFAULT 'OPEN',
    "consentAt" TIMESTAMP(3),
    "transcript" TEXT NOT NULL DEFAULT '',
    "audioSeconds" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,
    "confirmed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScribeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScribeSession_appointmentId_idx" ON "ScribeSession"("appointmentId");
CREATE INDEX "ScribeSession_doctorId_createdAt_idx" ON "ScribeSession"("doctorId", "createdAt");
