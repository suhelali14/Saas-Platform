-- The plan the Nayaversse console sets for this clinic over a signed call.
-- Additive: one new table; until the console writes a row, the env decides.
CREATE TABLE "ClinicPlanState" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "plan" TEXT NOT NULL,
    "features" TEXT,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "paidUntil" TIMESTAMP(3),
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClinicPlanState_pkey" PRIMARY KEY ("id")
);
