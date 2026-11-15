-- Contracts, Nayaverse's own GST invoices, and a history of plan changes.
--
-- Additive. Every existing account keeps its monthly fee and billing
-- cycle and becomes a SUBSCRIPTION, which is what it already was; new
-- accounts default to SETUP_YEARLY. Nothing is guessed into the new fee
-- columns: a made-up fee on a real deal is worse than an empty one.

CREATE TYPE "PricingModel" AS ENUM ('SETUP_YEARLY', 'SUBSCRIPTION', 'LICENCE_AMC');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

ALTER TABLE "ClinicAccount"
  ADD COLUMN IF NOT EXISTS "pricingModel" "PricingModel" NOT NULL DEFAULT 'SETUP_YEARLY',
  ADD COLUMN IF NOT EXISTS "setupFee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "yearlyFee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "licenceFee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "amcPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "hostingFee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "maxUsersOverride" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingName" TEXT,
  ADD COLUMN IF NOT EXISTS "billingAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "gstin" TEXT,
  ADD COLUMN IF NOT EXISTS "billingState" TEXT,
  -- What the clinic's server was last told, so an unapplied edit shows.
  ADD COLUMN IF NOT EXISTS "appliedPlan" "PlanTier",
  ADD COLUMN IF NOT EXISTS "appliedFeatures" TEXT,
  ADD COLUMN IF NOT EXISTS "appliedReadOnly" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Every account that existed before this was on a monthly fee, so that is
-- what it is: a subscription. Left on the new default (setup + yearly)
-- with no yearly fee, each one counted as ₹0 a month in the console.
UPDATE "ClinicAccount" SET "pricingModel" = 'SUBSCRIPTION' WHERE "monthlyFee" IS NOT NULL;

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "serial" INTEGER,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "isFirst" BOOLEAN NOT NULL DEFAULT false,
    "billingName" TEXT,
    "billingAddress" TEXT,
    "gstin" TEXT,
    "placeOfSupply" TEXT,
    "planLabel" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "igst" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMode" TEXT,
    "paymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- GST: one number per invoice, and serials unique within a financial year.
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE UNIQUE INDEX "Invoice_fy_serial_key" ON "Invoice"("fy", "serial");
CREATE INDEX "Invoice_accountId_createdAt_idx" ON "Invoice"("accountId", "createdAt");
CREATE INDEX "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");

-- RESTRICT: an account with invoices cannot be deleted from the console.
-- An issued tax invoice has to survive its customer.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlanChange" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromPlan" "PlanTier",
    "toPlan" "PlanTier" NOT NULL,
    "fromFeatures" TEXT,
    "toFeatures" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "actorName" TEXT NOT NULL,
    "jobId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanChange_accountId_at_idx" ON "PlanChange"("accountId", "at");

ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
