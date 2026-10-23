/**
 * What each plan includes.
 *
 * This is the vendor's view of the same decision the clinic app enforces at
 * boot from `CLINIC_PLAN`. The clinic app remains the authority — it
 * registers or does not register a route module. This table exists so the
 * console can show what a plan buys, price it, and generate the right
 * environment, without the sales answer and the running software drifting
 * apart.
 *
 * `FEATURES` deliberately lists more than the clinic app currently gates
 * on. Most modules ship to every tier because withholding billing or lab
 * orders from a paying clinic would make the product worse without making
 * the upsell more attractive; the tiers differ where the cost genuinely
 * differs.
 */

export interface FeatureSpec {
  key: string;
  label: string;
  description: string;
  /** Which tier first includes it. */
  from: "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  /** True when the clinic API actually gates on this today. The rest are
   * descriptive — saying otherwise in a sales conversation would be a
   * promise the software does not keep. */
  enforced: boolean;
}

export const FEATURES: FeatureSpec[] = [
  { key: "patients", label: "Patients & appointments", description: "Registration, UHID, today's queue, triage priority.", from: "BASIC", enforced: false },
  { key: "clinical", label: "Case sheets & prescriptions", description: "Consultation records, prescriptions with a 246k-medicine database, PDF output.", from: "BASIC", enforced: false },
  { key: "certificates", label: "Medical certificates", description: "Sick leave, fitness and referral certificates on clinic letterhead.", from: "BASIC", enforced: false },
  { key: "billing", label: "Billing & invoices", description: "Invoices, part payments, daily cash closing.", from: "BASIC", enforced: false },
  { key: "labs", label: "Lab orders & results", description: "Order tests, record results, attach reports.", from: "BASIC", enforced: false },
  { key: "publicsite", label: "Public website", description: "Patient-facing site with the clinic's own domain, live queue and health articles.", from: "BASIC", enforced: false },

  { key: "staff", label: "Staff accounts", description: "Reception, nurse and pharmacist logins with role-based access.", from: "STANDARD", enforced: true },
  { key: "pharmacy", label: "Pharmacy & stock", description: "Dispensing, batch stock with FEFO, expiry and low-stock alerts.", from: "STANDARD", enforced: false },
  { key: "analytics", label: "Analytics", description: "Visit trends, top diagnoses, doctor workload.", from: "STANDARD", enforced: false },
  { key: "expenses", label: "Expenses & P&L", description: "Expense ledger and profit-and-loss.", from: "STANDARD", enforced: false },

  { key: "multilingual", label: "Regional languages", description: "Patient site in up to 12 Indian languages.", from: "PREMIUM", enforced: false },
  { key: "audit", label: "Audit log & data export", description: "DPDP/NABH access log and full data export.", from: "PREMIUM", enforced: false },
  { key: "aitranslate", label: "AI translation", description: "Machine-drafted translations for the patient site.", from: "PREMIUM", enforced: false },
];

const ORDER = ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as const;
export type PlanTier = (typeof ORDER)[number];

/** Features a tier includes by default, before any deal-specific override. */
export function featuresForPlan(plan: PlanTier): string[] {
  const rank = ORDER.indexOf(plan);
  return FEATURES.filter((f) => ORDER.indexOf(f.from) <= rank).map((f) => f.key);
}

/**
 * Plan defaults merged with whatever was promised in the deal.
 *
 * Overrides can add *or* remove. A feature granted off-tier in a sales call
 * belongs in configuration, not in a note nobody reads a year later.
 */
export function resolveFeatures(plan: PlanTier, overrides: unknown): string[] {
  const base = new Set(featuresForPlan(plan));
  if (overrides && typeof overrides === "object") {
    for (const [key, enabled] of Object.entries(overrides as Record<string, unknown>)) {
      if (!FEATURES.some((f) => f.key === key)) continue; // ignore unknown keys
      if (enabled === true) base.add(key);
      if (enabled === false) base.delete(key);
    }
  }
  return [...base];
}

/** Indicative monthly pricing, in rupees. The console lets you set any fee
 * per account -- this is only the starting suggestion. */
export const SUGGESTED_MONTHLY_FEE: Record<PlanTier, number> = {
  BASIC: 3000,
  STANDARD: 7000,
  PREMIUM: 12000,
  ENTERPRISE: 25000,
};

/**
 * Active staff logins each plan covers. `null` is unlimited.
 *
 * This has to agree with clinic-api's own config/features.ts, which is what
 * actually enforces it -- the clinic API reads CLINIC_PLAN from its own .env
 * and refuses the seat there. The copy here exists so an operator quoting a
 * customer can see what they are promising; if the two ever disagree, the
 * clinic's own number is the one that will be enforced, and this one is the
 * one that lied.
 */
export const PLAN_MAX_USERS: Record<PlanTier, number | null> = {
  BASIC: 3,
  STANDARD: 8,
  PREMIUM: 20,
  ENTERPRISE: null,
};

/** For the console: "Standard — ₹7,000/mo, 8 logins". */
export function planSummary(tier: PlanTier): string {
  const seats = PLAN_MAX_USERS[tier];
  const fee = SUGGESTED_MONTHLY_FEE[tier].toLocaleString("en-IN");
  return `₹${fee}/mo · ${seats === null ? "unlimited" : seats} login${seats === 1 ? "" : "s"}`;
}
