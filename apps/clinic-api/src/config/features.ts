import { env } from "./env.js";

/**
 * What each plan includes.
 *
 * "Features according to money they give" -- which modules a deployment
 * registers at boot is driven by CLINIC_PLAN in that deployment's own .env.
 * A lower-tier clinic doesn't get a 403 on gated routes, the routes are
 * never registered at all (see app.ts), so there's nothing to probe.
 *
 * ── Seats, not modules, are the ladder ───────────────────────────────
 *
 * Staff management used to be the STANDARD+ differentiator, which meant a
 * BASIC clinic could not create a second login at all. That is wrong for
 * the product it actually is: a ₹3,000/month single-doctor practice still
 * has a receptionist, and telling them to share the doctor's password is
 * both a worse experience and a worse audit trail -- every action in the
 * log would read as the doctor's. So every tier can add staff now, and
 * what the money buys is how many.
 *
 * The prices below are the LIST price, recorded so the ladder is legible
 * in one place. The amount actually charged lives per-account in the
 * provider console's `monthlyFee`, because real deals differ.
 */

export type Feature = "staff";

export type PlanTier = "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";

export interface Plan {
  readonly tier: PlanTier;
  readonly label: string;
  /** Monthly list price in rupees. The billed figure is per-deal. */
  readonly monthlyFeeInr: number;
  readonly features: ReadonlySet<Feature>;
  /**
   * Active logins this plan allows, counting the doctor.
   *
   * `null` is unlimited, which only ENTERPRISE gets -- a hospital with
   * thirty staff is a negotiated deal, and a number in this table would
   * be a guess at someone else's org chart.
   */
  readonly maxUsers: number | null;
}

export const PLANS: Record<PlanTier, Plan> = {
  BASIC: {
    tier: "BASIC",
    label: "Basic",
    monthlyFeeInr: 3_000,
    features: new Set<Feature>(["staff"]),
    // A doctor, a receptionist, and one more -- the shape of a
    // single-doctor practice with cover for a day off.
    maxUsers: 3,
  },
  STANDARD: {
    tier: "STANDARD",
    label: "Standard",
    monthlyFeeInr: 7_000,
    features: new Set<Feature>(["staff"]),
    maxUsers: 8,
  },
  PREMIUM: {
    tier: "PREMIUM",
    label: "Premium",
    monthlyFeeInr: 12_000,
    features: new Set<Feature>(["staff"]),
    maxUsers: 20,
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    label: "Enterprise",
    monthlyFeeInr: 25_000,
    features: new Set<Feature>(["staff"]),
    maxUsers: null,
  },
};

export function currentPlan(): Plan {
  // env.CLINIC_PLAN is validated against these keys at boot, so an
  // unknown tier cannot reach here.
  return PLANS[env.CLINIC_PLAN];
}

export function isFeatureEnabled(feature: Feature): boolean {
  return currentPlan().features.has(feature);
}

/**
 * The seat cap for this deployment.
 *
 * CLINIC_MAX_USERS overrides the plan's number in both directions, because
 * a deal that includes two extra seats is a thing that happens in a sales
 * call and should survive as configuration rather than as a note nobody
 * reads. An override of 0 means unlimited, matching `null` above.
 */
export function maxUsers(): number | null {
  const override = env.CLINIC_MAX_USERS;
  if (override !== undefined) return override === 0 ? null : override;
  return currentPlan().maxUsers;
}

export interface SeatUsage {
  tier: PlanTier;
  label: string;
  /** Active logins now. Deactivated staff do not hold a seat. */
  used: number;
  /** null when unlimited. */
  max: number | null;
  remaining: number | null;
  canAddMore: boolean;
}

export function seatUsage(activeUsers: number): SeatUsage {
  const plan = currentPlan();
  const max = maxUsers();
  return {
    tier: plan.tier,
    label: plan.label,
    used: activeUsers,
    max,
    remaining: max === null ? null : Math.max(0, max - activeUsers),
    canAddMore: max === null || activeUsers < max,
  };
}
