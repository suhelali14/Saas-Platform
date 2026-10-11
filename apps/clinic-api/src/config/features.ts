import { env } from "./env.js";

// "Features according to money they give" -- which modules a deployment
// registers at boot is driven by CLINIC_PLAN in that deployment's own .env.
// A lower-tier clinic doesn't get a 403 on gated routes, the routes are
// never registered at all (see app.ts), so there's nothing to probe.

export type Feature = "staff";

const PLAN_FEATURES: Record<string, Set<Feature>> = {
  BASIC: new Set([]),
  STANDARD: new Set<Feature>(["staff"]),
  PREMIUM: new Set<Feature>(["staff"]),
};

export function isFeatureEnabled(feature: Feature): boolean {
  return PLAN_FEATURES[env.CLINIC_PLAN]?.has(feature) ?? false;
}
