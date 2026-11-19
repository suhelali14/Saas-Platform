-- Per-clinic certificate templates. The three hardcoded types stay;
-- the clinic can now have many templates per type ("Standard Sick
-- Leave", "Pediatric Fitness", "Referral to Dr. Deshmukh") and the
-- certificate issue form picks one of them and resolves {{placeholder}}
-- tokens against the real patient / doctor / clinic / date context.
--
-- Additive only: existing Certificate rows get a null `templateId`
-- (they were issued ad-hoc or from the hardcoded defaults, which are
-- now seeded as real template rows on the first list call).

CREATE TABLE "CertificateTemplate" (
  "id"          TEXT NOT NULL,
  "type"        "CertificateType" NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "body"        TEXT NOT NULL,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificateTemplate_type_name_key" ON "CertificateTemplate"("type", "name");
CREATE INDEX "CertificateTemplate_type_isActive_idx" ON "CertificateTemplate"("type", "isActive");

ALTER TABLE "CertificateTemplate"
  ADD CONSTRAINT "CertificateTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "ClinicUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The issued Certificate carries an optional pointer to the template it
-- came from. SET NULL on delete, not cascade: history must survive even
-- when the template that fathered it is retired.
ALTER TABLE "Certificate" ADD COLUMN "templateId" TEXT;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
