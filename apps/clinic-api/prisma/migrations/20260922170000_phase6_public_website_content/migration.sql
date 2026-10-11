-- Phase 6: richer public-website content so the clinic page is a real
-- landing page rather than an info card. Every field is content the clinic
-- fills in itself -- nothing here is ever populated with placeholder copy,
-- and the page hides any section left empty.

ALTER TABLE "Clinic" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "establishedYear" INTEGER;
ALTER TABLE "Clinic" ADD COLUMN "highlights" JSONB;
ALTER TABLE "Clinic" ADD COLUMN "faqs" JSONB;
ALTER TABLE "Clinic" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "mapUrl" TEXT;

ALTER TABLE "ClinicUser" ADD COLUMN "experienceYears" INTEGER;
ALTER TABLE "ClinicUser" ADD COLUMN "languages" TEXT;
