-- Quotation / Agreement / Pipeline — the three new models that turn the
-- provider console from a registry into a sales system. Every ALTER
-- below is additive; existing ClinicAccount rows are untouched beyond
-- picking up two new back-relations (which do not add columns).

CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "QuotationLineCategory" AS ENUM (
  'SOFTWARE',
  'IMPLEMENTATION',
  'TRAINING',
  'CUSTOMIZATION',
  'DATA_MIGRATION',
  'SUPPORT',
  'HARDWARE',
  'OTHER'
);
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'AWAITING_SIGN', 'ACTIVE', 'TERMINATED', 'EXPIRED');
CREATE TYPE "PipelineStage" AS ENUM (
  'NEW_LEAD',
  'QUALIFIED',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST'
);
CREATE TYPE "ActivityKind" AS ENUM (
  'CALL',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'MEETING',
  'WHATSAPP',
  'SITE_VISIT',
  'NOTE'
);

CREATE TABLE "Quotation" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "number" TEXT,
  "fy" TEXT,
  "serial" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "stage" "PipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
  "title" TEXT NOT NULL,
  "planTier" "PlanTier" NOT NULL DEFAULT 'BASIC',
  "clientName" TEXT NOT NULL,
  "clientAddress" TEXT,
  "clientGSTIN" TEXT,
  "clientState" TEXT,
  "clientContact" TEXT,
  "clientEmail" TEXT,
  "clientPhone" TEXT,
  "providerName" TEXT NOT NULL,
  "providerAddress" TEXT,
  "providerGSTIN" TEXT,
  "providerState" TEXT,
  "validUntil" TIMESTAMP(3),
  "subtotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "taxableAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "cgst" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "sgst" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "igst" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "scope" TEXT,
  "exclusions" TEXT,
  "paymentTerms" TEXT,
  "deliveryTerms" TEXT,
  "internalNotes" TEXT,
  "summary" TEXT,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "acceptedBy" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "lastContactedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quotation_number_key" ON "Quotation"("number");
CREATE UNIQUE INDEX "Quotation_fy_serial_version_key" ON "Quotation"("fy", "serial", "version");
CREATE INDEX "Quotation_accountId_createdAt_idx" ON "Quotation"("accountId", "createdAt");
CREATE INDEX "Quotation_status_validUntil_idx" ON "Quotation"("status", "validUntil");
CREATE INDEX "Quotation_stage_nextFollowUpAt_idx" ON "Quotation"("stage", "nextFollowUpAt");

ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QuotationLineItem" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "category" "QuotationLineCategory" NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity" DECIMAL(10, 2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12, 2) NOT NULL,
  "discount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "sac" TEXT,
  CONSTRAINT "QuotationLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotationLineItem_quotationId_sortOrder_idx"
  ON "QuotationLineItem"("quotationId", "sortOrder");

ALTER TABLE "QuotationLineItem"
  ADD CONSTRAINT "QuotationLineItem_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuotationActivity" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "kind" "ActivityKind" NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT,
  "outcome" TEXT,
  "actor" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isScheduled" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotationActivity_quotationId_at_idx" ON "QuotationActivity"("quotationId", "at");
CREATE INDEX "QuotationActivity_isScheduled_at_idx" ON "QuotationActivity"("isScheduled", "at");

ALTER TABLE "QuotationActivity"
  ADD CONSTRAINT "QuotationActivity_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Agreement" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "quotationId" TEXT,
  "number" TEXT,
  "fy" TEXT,
  "serial" INTEGER,
  "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "clauses" JSONB NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "termMonths" INTEGER NOT NULL DEFAULT 12,
  "noticeDays" INTEGER NOT NULL DEFAULT 60,
  "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "clientName" TEXT NOT NULL,
  "clientAddress" TEXT,
  "clientGSTIN" TEXT,
  "providerName" TEXT NOT NULL,
  "providerAddress" TEXT,
  "providerGSTIN" TEXT,
  "setupFee" DECIMAL(12, 2),
  "yearlyFee" DECIMAL(12, 2),
  "monthlyFee" DECIMAL(12, 2),
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "providerSignedBy" TEXT,
  "providerSignedAt" TIMESTAMP(3),
  "clientSignedByName" TEXT,
  "clientSignedByRole" TEXT,
  "clientSignedAt" TIMESTAMP(3),
  "clientSignatureRef" TEXT,
  "issuedAt" TIMESTAMP(3),
  "terminatedAt" TIMESTAMP(3),
  "terminationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agreement_number_key" ON "Agreement"("number");
CREATE UNIQUE INDEX "Agreement_fy_serial_key" ON "Agreement"("fy", "serial");
CREATE INDEX "Agreement_accountId_createdAt_idx" ON "Agreement"("accountId", "createdAt");
CREATE INDEX "Agreement_status_effectiveFrom_idx" ON "Agreement"("status", "effectiveFrom");

ALTER TABLE "Agreement"
  ADD CONSTRAINT "Agreement_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Agreement"
  ADD CONSTRAINT "Agreement_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
