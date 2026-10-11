-- Phase 5: editable clinic settings + per-doctor profile/credentials,
-- backing the internal settings screen and the public clinic page.
-- Hand-written per the established non-interactive migration workflow.

-- ── Clinic: contact + public page content ───────────────────────────────
ALTER TABLE "Clinic" ADD COLUMN "email" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "about" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "timings" JSONB;
ALTER TABLE "Clinic" ADD COLUMN "services" JSONB;

-- ── ClinicUser: per-doctor credentials (print on their own documents) ────
ALTER TABLE "ClinicUser" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "ClinicUser" ADD COLUMN "specialization" TEXT;
ALTER TABLE "ClinicUser" ADD COLUMN "bio" TEXT;
ALTER TABLE "ClinicUser" ADD COLUMN "photoPath" TEXT;
ALTER TABLE "ClinicUser" ADD COLUMN "signatureImagePath" TEXT;
ALTER TABLE "ClinicUser" ADD COLUMN "showOnPublicPage" BOOLEAN NOT NULL DEFAULT true;
