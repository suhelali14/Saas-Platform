import { env } from "./env.js";

/**
 * What each plan includes, and what this deployment has switched on.
 *
 * ── The ladder ────────────────────────────────────────────────────────
 *
 * Four tiers, named for the kind of place they fit. The enum keys are the
 * old ones (BASIC, STANDARD, PREMIUM, ENTERPRISE) because every live
 * deployment's env file and the provider console's database already say
 * them; renaming a key would be a migration on both sides and on every
 * server for no change in behaviour. Only the labels moved:
 *
 *   BASIC       Clinic           one doctor, a desk
 *   STANDARD    Polyclinic       several doctors, a pharmacy
 *   PREMIUM     Hospital         beds, departments, a cash counter
 *   ENTERPRISE  Multi-specialty  government schemes, radiology, wards
 *
 * ── Which modules are on ──────────────────────────────────────────────
 *
 * CLINIC_FEATURES, when set, is the exact list -- written by the provider
 * console, which has already applied the plan and any per-deal overrides
 * ("Polyclinic, plus the cash counter"). A plan change reaches a running
 * clinic by rewriting that line and restarting it (deploy/set-plan.sh),
 * not by a redeploy.
 *
 * Unset, the plan decides -- with one exception that matters. Clinics
 * provisioned before modules were enforced had every module, whatever
 * their plan said, because nothing checked. Taking pharmacy away from a
 * live clinic on a deploy because its env file says BASIC would break a
 * paying customer's dispensary in the middle of a day. So without an
 * explicit list, every module that existed then stays on, and only the
 * hospital modules added since follow the plan.
 *
 * ── Never gated ───────────────────────────────────────────────────────
 *
 * Patients, appointments, the queue, case sheets, prescriptions,
 * certificates, the public website, the audit log and data export. The
 * first six are what every tier is for. The audit log is a legal duty
 * (DPDP, and NABH for those seeking it), not an upsell, and data export is
 * how a clinic leaves -- a clinic that cannot take its own records with it
 * is locked in, which is the one thing this product must never do.
 *
 * ── How a disabled module looks ───────────────────────────────────────
 *
 * Its routes are never registered (see app.ts), so they 404 like any
 * other path and there is nothing to probe. The portal hides it from the
 * menu and, if someone follows an old link, says which plan includes it
 * and how to ask for it.
 */

export type PlanTier = "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";

export const PLAN_ORDER: readonly PlanTier[] = ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"];

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASIC: "Clinic",
  STANDARD: "Polyclinic",
  PREMIUM: "Hospital",
  ENTERPRISE: "Multi-specialty",
};

export interface ModuleSpec {
  readonly key: string;
  readonly label: string;
  /** The first tier that includes it. */
  readonly from: PlanTier;
  /** Existed before modules were enforced, so stays on for a deployment
   *  with no explicit CLINIC_FEATURES. See the note above. */
  readonly legacy: boolean;
}

/**
 * The catalogue. Order is the order the provider console lists them.
 *
 * Keep in step with apps/provider-api/src/lib/plans.ts -- a test there
 * fails if the two lists disagree, because a module the console can sell
 * but the clinic cannot switch on is a promise the software does not keep.
 */
export const MODULES = [
  { key: "staff", label: "Staff accounts", from: "BASIC", legacy: true },
  { key: "billing", label: "Billing & invoices", from: "BASIC", legacy: true },
  { key: "labs", label: "Lab orders & results", from: "BASIC", legacy: true },
  { key: "pharmacy", label: "Pharmacy & stock", from: "STANDARD", legacy: true },
  { key: "analytics", label: "Reports", from: "STANDARD", legacy: true },
  { key: "expenses", label: "Expenses & profit", from: "STANDARD", legacy: true },
  { key: "multilingual", label: "Website in Indian languages", from: "STANDARD", legacy: true },
  { key: "aitranslate", label: "Machine translation", from: "PREMIUM", legacy: true },
  { key: "departments", label: "Departments & service points", from: "PREMIUM", legacy: false },
  { key: "cashcounter", label: "Cash counter", from: "PREMIUM", legacy: false },
  { key: "ipd", label: "Inpatients, wards & beds", from: "PREMIUM", legacy: false },
  { key: "ot", label: "Operation theatre", from: "PREMIUM", legacy: false },
  { key: "insurance", label: "Insurance & TPA desk", from: "PREMIUM", legacy: false },
  { key: "schemes", label: "Government schemes desk", from: "ENTERPRISE", legacy: false },
  { key: "radiology", label: "Radiology", from: "ENTERPRISE", legacy: false },
  { key: "nursing", label: "Nursing stations", from: "ENTERPRISE", legacy: false },
] as const satisfies readonly ModuleSpec[];

export type Feature = (typeof MODULES)[number]["key"];

const MODULE_KEYS = new Set<string>(MODULES.map((m) => m.key));

export function isModuleKey(key: string): key is Feature {
  return MODULE_KEYS.has(key);
}

/** Active logins each plan allows, counting the doctor. null is unlimited. */
export const PLAN_MAX_USERS: Record<PlanTier, number | null> = {
  // A doctor, a receptionist, and one more for a day off.
  BASIC: 3,
  STANDARD: 10,
  PREMIUM: 40,
  // A multi-specialty hospital's staff list is a negotiated number, and a
  // figure here would be a guess at someone else's org chart.
  ENTERPRISE: null,
};

export interface Plan {
  readonly tier: PlanTier;
  readonly label: string;
  readonly maxUsers: number | null;
}

export function planDefaults(tier: PlanTier): Set<Feature> {
  const rank = PLAN_ORDER.indexOf(tier);
  return new Set(MODULES.filter((m) => PLAN_ORDER.indexOf(m.from) <= rank).map((m) => m.key));
}

/**
 * The modules this deployment has on. Pure, so it can be tested with any
 * env; `enabledModules()` below is the one the app uses.
 */
export function resolveModules(tier: PlanTier, explicit: string | undefined): Set<Feature> {
  if (explicit !== undefined && explicit.trim() !== "") {
    const list = explicit.split(",").map((s) => s.trim()).filter(Boolean);
    // Unknown names are dropped, not fatal: an env file written by a newer
    // console must not stop an older clinic API from booting.
    return new Set(list.filter(isModuleKey));
  }
  const on = planDefaults(tier);
  for (const m of MODULES) if (m.legacy) on.add(m.key);
  return on;
}

let cached: Set<Feature> | null = null;

export function enabledModules(): Set<Feature> {
  if (!cached) cached = resolveModules(env.CLINIC_PLAN, env.CLINIC_FEATURES);
  return cached;
}

export function isFeatureEnabled(feature: Feature): boolean {
  return enabledModules().has(feature);
}

/** Every module and whether it is on, for /auth/me and the portal. */
export function moduleStates(): Record<Feature, boolean> {
  const on = enabledModules();
  return Object.fromEntries(MODULES.map((m) => [m.key, on.has(m.key)])) as Record<Feature, boolean>;
}

export function currentPlan(): Plan {
  // env.CLINIC_PLAN is validated against these keys at boot, so an
  // unknown tier cannot reach here.
  const tier = env.CLINIC_PLAN;
  return { tier, label: PLAN_LABELS[tier], maxUsers: PLAN_MAX_USERS[tier] };
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
