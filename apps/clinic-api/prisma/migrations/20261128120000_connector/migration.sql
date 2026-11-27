-- The Nayaverse Growth connector (Growth's D50): tokens the clinic gives
-- its WhatsApp assistant, and where a booking request came from.
--
-- Additive only: four nullable columns and one with a default on the
-- request list, and a new table. No existing row changes meaning; website
-- requests read exactly as before.

ALTER TABLE "AppointmentRequest" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'website';
ALTER TABLE "AppointmentRequest" ADD COLUMN "requestedAt" TIMESTAMP(3);
ALTER TABLE "AppointmentRequest" ADD COLUMN "doctorId" TEXT;
ALTER TABLE "AppointmentRequest" ADD COLUMN "serviceName" TEXT;
ALTER TABLE "AppointmentRequest" ADD COLUMN "connectorTokenId" TEXT;

CREATE TABLE "ConnectorToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenTail" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByName" TEXT,

    CONSTRAINT "ConnectorToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectorToken_tokenHash_key" ON "ConnectorToken"("tokenHash");
