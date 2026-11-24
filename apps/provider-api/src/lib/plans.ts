/**
 * The plans this console sells, the modules in each, and what they cost.
 *
 * ── Modules ───────────────────────────────────────────────────────────
 *
 * The keys are the clinic API's own (apps/clinic-api/src/config/features.ts),
 * and a test fails if the two lists drift: a module this console can sell
 * but a clinic cannot switch on is a promise the software does not keep.
 * The resolved list for an account -- its plan, plus the deal's additions
 * and removals -- is written into the clinic's env file as CLINIC_FEATURES
 * by deploy/set-plan.sh, and the clinic registers only those modules.
 *
 * Some things are in every plan and are not modules at all: patients,
 * appointments, the queue, case sheets, prescriptions, certificates, the
 * public website, the audit log and data export. The last two are a legal
 * duty and a clinic's way out, and are never sold separately.
 *
 * ── Prices ────────────────────────────────────────────────────────────
 *
 * List prices, as a starting point for a deal; what an account is actually
 * charged is stored on the account. The default model is a one-time setup
 * fee plus a yearly service fee, chosen because every clinic is hosted
 * here and costs money every month -- "pay once, small AMC" only works for
 * software the customer runs on their own server.
 *
 * Set against what Indian vendors publish in 2026 (see
 * docs/PRICING-RESEARCH.md): small clinics ₹2,000-10,000 a month,
 * 20-50 bed hospitals ₹15,000-35,000, 50-200 beds ₹35,000-75,000; a
 * licence's yearly maintenance is 15-25% of the licence.
 */

export type PlanTier = "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";

export const PLAN_ORDER: readonly PlanTier[] = ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"];

export const PLAN_LABELS: Record<PlanTier, string> = {
  BASIC: "Clinic",
  STANDARD: "Polyclinic",
  PREMIUM: "Hospital",
  ENTERPRISE: "Multi-specialty",
};

export const PLAN_FITS: Record<PlanTier, string> = {
  BASIC: "One doctor and a front desk.",
  STANDARD: "Several doctors, a pharmacy, no beds.",
  PREMIUM: "A hospital with beds, up to about 50.",
  ENTERPRISE: "A multi-specialty hospital, government schemes, 50+ beds.",
};

export interface FeatureSpec {
  key: string;
  label: string;
  description: string;
  /** Which tier first includes it. */
  from: PlanTier;
  /** True when the clinic API registers this module only when it is on.
   *  Every module is enforced now; kept so the console can say so. */
  enforced: boolean;
  /** Built and working, as opposed to sellable-but-coming. A module that
   *  is not built yet is never shown as included without saying so. */
  built: boolean;
}

export const FEATURES: FeatureSpec[] = [
  { key: "staff", label: "Staff accounts", description: "A login for each person, with role-based access.", from: "BASIC", enforced: true, built: true },
  { key: "billing", label: "Billing & invoices", description: "Bills, part payments, daily cash closing.", from: "BASIC", enforced: true, built: true },
  { key: "labs", label: "Lab orders & results", description: "Order tests, record results, attach reports.", from: "BASIC", enforced: true, built: true },
  { key: "pharmacy", label: "Pharmacy & stock", description: "Dispensing, batch stock with FEFO, expiry and low-stock alerts.", from: "STANDARD", enforced: true, built: true },
  { key: "analytics", label: "Reports", description: "Visit trends, top diagnoses, doctor workload.", from: "STANDARD", enforced: true, built: true },
  { key: "expenses", label: "Expenses & profit", description: "Expense ledger and profit-and-loss.", from: "STANDARD", enforced: true, built: true },
  { key: "multilingual", label: "Website languages", description: "Patient site in up to 12 Indian languages.", from: "STANDARD", enforced: true, built: true },
  { key: "aitranslate", label: "Machine translation", description: "Machine-drafted translations for the patient site.", from: "PREMIUM", enforced: true, built: true },
  { key: "departments", label: "Departments & service points", description: "Specialities and counters; each person sees only their own work.", from: "PREMIUM", enforced: true, built: true },
  { key: "cashcounter", label: "Cash counter", description: "Counter sessions, deposits, refunds, discount approval, day close.", from: "PREMIUM", enforced: true, built: true },
  { key: "ipd", label: "Inpatients, wards & beds", description: "Admission, transfer, discharge, bed board, interim and final bills.", from: "PREMIUM", enforced: true, built: true },
  { key: "ot", label: "Operation theatre", description: "Theatre bookings and surgery records.", from: "PREMIUM", enforced: true, built: true },
  { key: "insurance", label: "Insurance & TPA desk", description: "Pre-authorisation, claims, settlements and ageing.", from: "PREMIUM", enforced: true, built: true },
  { key: "schemes", label: "Government schemes desk", description: "PM-JAY, MJPJAY, CGHS and ECHS: packages, pre-auth, claims.", from: "ENTERPRISE", enforced: true, built: true },
  { key: "radiology", label: "Radiology", description: "Imaging orders and reports.", from: "ENTERPRISE", enforced: true, built: true },
  { key: "nursing", label: "Nursing stations", description: "Ward rounds, vitals charts, medicine given.", from: "ENTERPRISE", enforced: true, built: true },
  { key: "scribe", label: "Clinic assistant", description: "Listens to the consultation and drafts the case sheet, prescription and tests for the doctor to confirm. An add-on: each consultation has a running cost.", from: "ENTERPRISE", enforced: true, built: true },
];

/** In every plan, never a module. Shown on the plan sheet. */
export const ALWAYS_INCLUDED = [
  "Patients, appointments and the queue with tokens",
  "Case sheets, prescriptions and certificates",
  "The clinic's own website",
  "Audit log and full data export",
];

/**
 * Modules that existed before the clinic API enforced modules. A clinic
 * whose env file has no CLINIC_FEATURES line runs all of these whatever
 * its plan says (apps/clinic-api/src/config/features.ts), so the console
 * must count them as running -- otherwise the first suspend, resume or
 * apply on an old clinic would quietly switch its pharmacy off.
 */
export const LEGACY_MODULES = ["staff", "billing", "labs", "pharmacy", "analytics", "expenses", "multilingual", "aitranslate"];

/**
 * What a clinic is running now, as far as this console knows.
 *
 * Once a plan has been applied, exactly what was applied. Before that, a
 * provisioned clinic runs its plan plus every legacy module, because its
 * env file has no list; an account that was never provisioned runs
 * nothing yet and is shown its plan.
 */
export function runningFeatures(a: { plan: string; appliedFeatures: string | null; provisionedAt: Date | null; status: string }): string[] {
  if (a.appliedFeatures !== null) return a.appliedFeatures.split(",").filter(Boolean);
  const provisioned = !!a.provisionedAt || a.status === "LIVE" || a.status === "SUSPENDED";
  const base = new Set(featuresForPlan(a.plan as PlanTier));
  if (provisioned) for (const k of LEGACY_MODULES) base.add(k);
  return FEATURES.map((f) => f.key).filter((k) => base.has(k));
}

export function featuresForPlan(plan: PlanTier): string[] {
  const rank = PLAN_ORDER.indexOf(plan);
  return FEATURES.filter((f) => PLAN_ORDER.indexOf(f.from) <= rank).map((f) => f.key);
}

export function resolveFeatures(plan: PlanTier, overrides: unknown): string[] {
  const base = new Set(featuresForPlan(plan));
  if (overrides && typeof overrides === "object") {
    for (const [key, enabled] of Object.entries(overrides as Record<string, unknown>)) {
      if (!FEATURES.some((f) => f.key === key)) continue; // ignore unknown keys
      if (enabled === true) base.add(key);
      if (enabled === false) base.delete(key);
    }
  }
  // Catalogue order, so the env line and the console read the same way.
  return FEATURES.map((f) => f.key).filter((k) => base.has(k));
}

/** Active logins each plan allows, counting the doctor. null is unlimited. */
export const PLAN_MAX_USERS: Record<PlanTier, number | null> = {
  BASIC: 3,
  STANDARD: 10,
  PREMIUM: 40,
  ENTERPRISE: null,
};

export type PricingModel = "SETUP_YEARLY" | "SUBSCRIPTION" | "LICENCE_AMC";

export interface ListPrice {
  /** One-time: installation, data import, training, domain. */
  setupFee: number;
  /** Hosting, updates and support for a year. */
  yearlyFee: number;
  /** For the subscription model. */
  monthlyFee: number;
  /** For the licence model: about 2.5 years of the yearly fee. */
  licenceFee: number;
  /** For the licence model: yearly maintenance, as a percentage. */
  amcPercent: number;
}

/** List prices in rupees, before GST. A starting point for a deal. */
export const LIST_PRICES: Record<PlanTier, ListPrice> = {
  BASIC: { setupFee: 15_000, yearlyFee: 36_000, monthlyFee: 3_000, licenceFee: 90_000, amcPercent: 20 },
  STANDARD: { setupFee: 25_000, yearlyFee: 84_000, monthlyFee: 7_000, licenceFee: 2_10_000, amcPercent: 20 },
  PREMIUM: { setupFee: 75_000, yearlyFee: 2_40_000, monthlyFee: 20_000, licenceFee: 6_00_000, amcPercent: 20 },
  ENTERPRISE: { setupFee: 1_50_000, yearlyFee: 6_00_000, monthlyFee: 50_000, licenceFee: 15_00_000, amcPercent: 20 },
};

/** Kept for older console builds that read a monthly figure. */
export const SUGGESTED_MONTHLY_FEE: Record<PlanTier, number> = {
  BASIC: LIST_PRICES.BASIC.monthlyFee,
  STANDARD: LIST_PRICES.STANDARD.monthlyFee,
  PREMIUM: LIST_PRICES.PREMIUM.monthlyFee,
  ENTERPRISE: LIST_PRICES.ENTERPRISE.monthlyFee,
};

export function planSummary(tier: PlanTier): string {
  const seats = PLAN_MAX_USERS[tier];
  const p = LIST_PRICES[tier];
  return `${PLAN_LABELS[tier]} · ₹${p.setupFee.toLocaleString("en-IN")} setup + ₹${p.yearlyFee.toLocaleString("en-IN")}/yr · ${seats === null ? "unlimited" : seats} logins`;
}
