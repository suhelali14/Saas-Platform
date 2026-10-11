-- Phase 7: audit trail + expense ledger.
-- Hand-written and applied with `prisma migrate deploy` -- `migrate dev`
-- needs a TTY, and `migrate diff --to-schema-datamodel` can't see the
-- `clinic` schema qualification and emits a bogus full drop-and-recreate.

-- Append-only PHI access log. No UPDATE/DELETE route exists for this table
-- anywhere in the API, by design.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clinicUserId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "patientId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");
-- The query an auditor actually runs: everyone who touched one patient.
CREATE INDEX "AuditLog_patientId_at_idx" ON "AuditLog"("patientId", "at");
CREATE INDEX "AuditLog_clinicUserId_at_idx" ON "AuditLog"("clinicUserId", "at");

-- Expense ledger -- the other half of the SRS's billing module.
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "vendor" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_paidAt_idx" ON "Expense"("paidAt");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "ClinicUser"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
