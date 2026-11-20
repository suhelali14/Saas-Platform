-- InvoiceItem gets two optional back-pointers: to the Appointment the
-- line belongs to (so the printed bill can group by visit date on a
-- multi-visit episode bill) and to the ServiceItem it was picked from
-- (so a year later we can audit "why did the consultation price change
-- in Q3"). Both ON DELETE SET NULL -- historic line items survive even
-- when the visit or catalogue item is retired.

ALTER TABLE "InvoiceItem" ADD COLUMN "serviceItemId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "InvoiceItem_appointmentId_idx" ON "InvoiceItem"("appointmentId");
CREATE INDEX "InvoiceItem_serviceItemId_idx" ON "InvoiceItem"("serviceItemId");

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_serviceItemId_fkey"
  FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
