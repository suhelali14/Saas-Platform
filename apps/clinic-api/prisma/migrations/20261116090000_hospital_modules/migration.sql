-- Hospital modules: departments, cash counter, inpatients, insurance and
-- scheme claims, operation theatre, radiology, nursing.
--
-- Additive only: new enums, new enum values, new tables, and nullable or
-- defaulted columns on Appointment, Payment, Invoice and Clinic. Every
-- clinic database gets these tables whatever its plan, so a plan change
-- never needs a migration; the plan decides which modules the API serves.
--
-- New enum values are appended (ClinicRole, PaymentMode). Postgres orders
-- an enum by declaration, and inserting a value anywhere but the end would
-- reorder every existing row's meaning.

-- CreateEnum
CREATE TYPE "DepartmentKind" AS ENUM ('CLINICAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ServicePoint" AS ENUM ('FRONT_DESK', 'CASH_COUNTER', 'INSURANCE', 'SCHEMES', 'PHARMACY', 'LAB', 'RADIOLOGY', 'OT', 'WARD', 'RECORDS');

-- CreateEnum
CREATE TYPE "DepositKind" AS ENUM ('ADVANCE', 'REFUND', 'APPLIED');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WardKind" AS ENUM ('GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU', 'NICU', 'DAYCARE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('SELF', 'INSURANCE', 'SCHEME');

-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('NURSING', 'DOCTOR_VISIT', 'PROCEDURE', 'MEDICINE', 'CONSUMABLE', 'LAB', 'RADIOLOGY', 'OT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimPayer" AS ENUM ('INSURANCE', 'SCHEME');

-- CreateEnum
CREATE TYPE "PreauthStatus" AS ENUM ('NOT_NEEDED', 'DRAFT', 'SUBMITTED', 'QUERY', 'APPROVED', 'ENHANCEMENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'QUERY', 'APPROVED', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OtStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('XRAY', 'USG', 'CT', 'MRI', 'ECG', 'ECHO', 'OTHER');

-- CreateEnum
CREATE TYPE "RadiologyStatus" AS ENUM ('ORDERED', 'DONE', 'REPORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NursingKind" AS ENUM ('VITALS', 'NOTE', 'MEDICATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ClinicRole" ADD VALUE 'CASHIER';
ALTER TYPE "ClinicRole" ADD VALUE 'BILLING_CLERK';
ALTER TYPE "ClinicRole" ADD VALUE 'LAB_TECH';
ALTER TYPE "ClinicRole" ADD VALUE 'RADIOGRAPHER';

-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'DEPOSIT';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "discountApprovalAbove" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "admissionId" TEXT,
ADD COLUMN     "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountApprovedBy" TEXT,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountRequestedBy" TEXT,
ADD COLUMN     "discountStatus" "DiscountStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "counterSessionId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DepartmentKind" NOT NULL,
    "service" "ServicePoint",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMember" (
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DepartmentMember_pkey" PRIMARY KEY ("departmentId","userId")
);

-- CreateTable
CREATE TABLE "CounterSession" (
    "id" TEXT NOT NULL,
    "counterName" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingCash" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "closedByName" TEXT,
    "countedCash" DECIMAL(10,2),
    "expectedCash" DECIMAL(10,2),
    "notes" TEXT,

    CONSTRAINT "CounterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "kind" "DepositKind" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" "PaymentMode",
    "invoiceId" TEXT,
    "counterSessionId" TEXT,
    "byId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WardKind" NOT NULL,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "blockedReason" TEXT,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "ipNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admittingDoctorId" TEXT,
    "departmentId" TEXT,
    "bedId" TEXT,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "provisionalDiagnosis" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "payerType" "PayerType" NOT NULL DEFAULT 'SELF',
    "estimatedCost" DECIMAL(10,2),
    "dischargedAt" TIMESTAMP(3),
    "finalDiagnosis" TEXT,
    "treatmentGiven" TEXT,
    "conditionAtDischarge" TEXT,
    "dischargeAdvice" TEXT,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedMove" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byName" TEXT NOT NULL,

    CONSTRAINT "BedMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionCharge" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "category" "ChargeCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rate" DECIMAL(10,2) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byName" TEXT NOT NULL,

    CONSTRAINT "AdmissionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT,
    "patientId" TEXT NOT NULL,
    "payer" "ClaimPayer" NOT NULL,
    "payerName" TEXT NOT NULL,
    "scheme" TEXT,
    "memberId" TEXT,
    "packageCode" TEXT,
    "packageName" TEXT,
    "packageRate" DECIMAL(10,2),
    "preauthStatus" "PreauthStatus" NOT NULL DEFAULT 'DRAFT',
    "preauthNumber" TEXT,
    "preauthAmount" DECIMAL(10,2),
    "preauthApprovedAt" TIMESTAMP(3),
    "preauthValidTill" TIMESTAMP(3),
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "claimAmount" DECIMAL(10,2),
    "claimSubmittedAt" TIMESTAMP(3),
    "approvedAmount" DECIMAL(10,2),
    "settledAmount" DECIMAL(10,2),
    "settledAt" TIMESTAMP(3),
    "settlementRef" TEXT,
    "deductionReason" TEXT,
    "documents" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byName" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemePackage" (
    "id" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "documents" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtBooking" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "surgeonId" TEXT,
    "anaesthetist" TEXT,
    "theatre" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "status" "OtStatus" NOT NULL DEFAULT 'SCHEDULED',
    "anaesthesiaType" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "operationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "admissionId" TEXT,
    "orderedById" TEXT,
    "modality" "Modality" NOT NULL,
    "study" TEXT NOT NULL,
    "clinicalNotes" TEXT,
    "status" "RadiologyStatus" NOT NULL DEFAULT 'ORDERED',
    "doneAt" TIMESTAMP(3),
    "report" TEXT,
    "impression" TEXT,
    "reportedByName" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiologyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NursingEntry" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "kind" "NursingKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byName" TEXT NOT NULL,
    "vitals" JSONB,
    "note" TEXT,
    "drugName" TEXT,
    "dose" TEXT,
    "route" TEXT,

    CONSTRAINT "NursingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "DepartmentMember_userId_idx" ON "DepartmentMember"("userId");

-- CreateIndex
CREATE INDEX "CounterSession_openedById_closedAt_idx" ON "CounterSession"("openedById", "closedAt");

-- CreateIndex
CREATE INDEX "CounterSession_openedAt_idx" ON "CounterSession"("openedAt");

-- CreateIndex
CREATE INDEX "Deposit_patientId_at_idx" ON "Deposit"("patientId", "at");

-- CreateIndex
CREATE INDEX "Deposit_admissionId_idx" ON "Deposit"("admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_name_key" ON "Ward"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_wardId_label_key" ON "Bed"("wardId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_ipNumber_key" ON "Admission"("ipNumber");

-- CreateIndex
CREATE INDEX "Admission_status_idx" ON "Admission"("status");

-- CreateIndex
CREATE INDEX "Admission_patientId_idx" ON "Admission"("patientId");

-- CreateIndex
CREATE INDEX "BedMove_admissionId_at_idx" ON "BedMove"("admissionId", "at");

-- CreateIndex
CREATE INDEX "AdmissionCharge_admissionId_at_idx" ON "AdmissionCharge"("admissionId", "at");

-- CreateIndex
CREATE INDEX "Claim_payer_claimStatus_idx" ON "Claim"("payer", "claimStatus");

-- CreateIndex
CREATE INDEX "Claim_patientId_idx" ON "Claim"("patientId");

-- CreateIndex
CREATE INDEX "ClaimEvent_claimId_at_idx" ON "ClaimEvent"("claimId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "SchemePackage_scheme_code_key" ON "SchemePackage"("scheme", "code");

-- CreateIndex
CREATE INDEX "OtBooking_scheduledAt_idx" ON "OtBooking"("scheduledAt");

-- CreateIndex
CREATE INDEX "RadiologyOrder_status_createdAt_idx" ON "RadiologyOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RadiologyOrder_patientId_idx" ON "RadiologyOrder"("patientId");

-- CreateIndex
CREATE INDEX "NursingEntry_admissionId_at_idx" ON "NursingEntry"("admissionId", "at");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_counterSessionId_fkey" FOREIGN KEY ("counterSessionId") REFERENCES "CounterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ClinicUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_counterSessionId_fkey" FOREIGN KEY ("counterSessionId") REFERENCES "CounterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_admittingDoctorId_fkey" FOREIGN KEY ("admittingDoctorId") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedMove" ADD CONSTRAINT "BedMove_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedMove" ADD CONSTRAINT "BedMove_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionCharge" ADD CONSTRAINT "AdmissionCharge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtBooking" ADD CONSTRAINT "OtBooking_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtBooking" ADD CONSTRAINT "OtBooking_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtBooking" ADD CONSTRAINT "OtBooking_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyOrder" ADD CONSTRAINT "RadiologyOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "ClinicUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingEntry" ADD CONSTRAINT "NursingEntry_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Inpatient numbers (IP-2026-00001) come from a sequence, as UHIDs do:
-- two admissions at the same second must never share a number.
CREATE SEQUENCE IF NOT EXISTS "ip_number_seq" START 1;
