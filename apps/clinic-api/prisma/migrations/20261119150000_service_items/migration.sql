-- ServiceItem: the clinic's / doctor's "bill board" -- a saved catalogue
-- of items that get billed repeatedly (consultation types, procedures,
-- injections, dressings). The invoice editor picks from this list in
-- one tap; the free-text 'type anything' path stays for one-off items.
--
-- Clinic-wide when doctorId is null; doctor's personal board when set.
-- Linked to a Drug row optionally so dispensing a stocked injection
-- decrements via FEFO without a second step.

CREATE TABLE "ServiceItem" (
  "id"           TEXT NOT NULL,
  "code"         TEXT,
  "name"         TEXT NOT NULL,
  "category"     "InvoiceItemCategory" NOT NULL,
  "defaultPrice" DECIMAL(10, 2) NOT NULL,
  "doctorId"     TEXT,
  "drugId"       TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "description"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceItem_doctorId_name_key" ON "ServiceItem"("doctorId", "name");
CREATE INDEX "ServiceItem_category_isActive_idx" ON "ServiceItem"("category", "isActive");

ALTER TABLE "ServiceItem"
  ADD CONSTRAINT "ServiceItem_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "ClinicUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceItem"
  ADD CONSTRAINT "ServiceItem_drugId_fkey"
  FOREIGN KEY ("drugId") REFERENCES "Drug"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
