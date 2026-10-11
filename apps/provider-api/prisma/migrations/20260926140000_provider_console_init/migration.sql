-- Provider console, initial schema.
--
-- Lives in its own "provider" namespace inside the same Postgres instance
-- as the clinic databases. Separate namespace, not a separate server:
-- these tables hold commercial and deployment metadata, never patient
-- data, so they do not need the isolation a clinic database does -- but
-- they must never be reachable from a clinic deployment either.
CREATE SCHEMA IF NOT EXISTS "provider";
SET search_path TO "provider";

-- CreateEnum
CREATE TYPE "ProviderRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('LEAD', 'ONBOARDING', 'LIVE', 'SUSPENDED', 'CHURNED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "ProviderUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ProviderRole" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicAccount" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'LEAD',
    "plan" "PlanTier" NOT NULL DEFAULT 'BASIC',
    "featureOverrides" JSONB,
    "monthlyFee" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "startedAt" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),
    "publicDomain" TEXT,
    "portalDomain" TEXT,
    "apiDomain" TEXT,
    "neonProjectId" TEXT,
    "vercelWebProjectId" TEXT,
    "vercelApiProjectId" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT true,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderUser_email_key" ON "ProviderUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicAccount_slug_key" ON "ClinicAccount"("slug");

-- CreateIndex
CREATE INDEX "ClinicAccount_status_idx" ON "ClinicAccount"("status");

-- CreateIndex
CREATE INDEX "OnboardingStep_accountId_sortOrder_idx" ON "OnboardingStep"("accountId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_accountId_key_key" ON "OnboardingStep"("accountId", "key");

-- CreateIndex
CREATE INDEX "ActivityLog_accountId_at_idx" ON "ActivityLog"("accountId", "at");

-- CreateIndex
CREATE INDEX "ActivityLog_at_idx" ON "ActivityLog"("at");

-- CreateIndex
CREATE INDEX "HealthCheck_accountId_checkedAt_idx" ON "HealthCheck"("accountId", "checkedAt");

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "ProviderUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ClinicAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

