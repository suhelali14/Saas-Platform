-- Phase 4: unified billing, pharmacy inventory (FEFO), lab orders.
-- Hand-written per the established non-interactive migration workflow.

-- ── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "InvoiceItemCategory" AS ENUM ('CONSULTATION', 'MEDICINE', 'PROCEDURE', 'LAB', 'OTHER');
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD');
CREATE TYPE "LabOrderStatus" AS ENUM ('ORDERED', 'COMPLETED', 'CANCELLED');

-- ── Clinic: default consultation fee (billing line-item seed) ─────────────
ALTER TABLE "Clinic" ADD COLUMN "defaultConsultationFee" DECIMAL(10,2);

-- ── Drug: price back (for billing suggestions) + batches (FEFO) ──────────
ALTER TABLE "Drug" ADD COLUMN "price" DECIMAL(10,2);

CREATE TABLE "DrugBatch" (
    "id" TEXT NOT NULL,
    "drugId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantityInHand" INTEGER NOT NULL,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 10,
    "costPrice" DECIMAL(10,2),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrugBatch_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DrugBatch" ADD CONSTRAINT "DrugBatch_drugId_fkey"
  FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DrugBatch_drugId_idx" ON "DrugBatch"("drugId");
CREATE INDEX "DrugBatch_expiryDate_idx" ON "DrugBatch"("expiryDate");

-- ── PrescriptionItem: link to Drug for FEFO decrementing ──────────────────
ALTER TABLE "PrescriptionItem" ADD COLUMN "drugId" TEXT;
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_drugId_fkey"
  FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Billing ─────────────────────────────────────────────────────────────
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_patientId_idx" ON "Invoice"("patientId");
CREATE INDEX "Invoice_appointmentId_idx" ON "Invoice"("appointmentId");

CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "category" "InvoiceItemCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "receivedById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "ClinicUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- ── Lab orders ──────────────────────────────────────────────────────────
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalRange" TEXT,
    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LabTest_name_key" ON "LabTest"("name");

CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "doctorId" TEXT NOT NULL,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "ClinicUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");
CREATE INDEX "LabOrder_appointmentId_idx" ON "LabOrder"("appointmentId");

CREATE TABLE "LabOrderItem" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "resultText" TEXT,
    "resultFilePath" TEXT,
    "resultFileName" TEXT,
    "resultFileMime" TEXT,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_labOrderId_fkey"
  FOREIGN KEY ("labOrderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
