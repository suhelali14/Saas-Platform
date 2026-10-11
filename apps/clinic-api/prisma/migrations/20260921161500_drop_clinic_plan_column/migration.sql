-- Plan gating moved entirely to CLINIC_PLAN (env, read once at boot) so
-- there is exactly one source of truth for which features a deployment
-- has active. The DB-stored plan column was found to drift from that in
-- dev testing (changed the env without re-seeding) -- removing it rather
-- than risk that happening in a real clinic deployment.
ALTER TABLE "Clinic" DROP COLUMN "plan";
DROP TYPE "PlanType";
