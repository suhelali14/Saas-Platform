export type PlanTier = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type AccountStatus = 'LEAD' | 'ONBOARDING' | 'LIVE' | 'SUSPENDED' | 'CHURNED';

export interface HealthCheck {
  id: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface OnboardingStep {
  id: string;
  key: string;
  label: string;
  automated: boolean;
  done: boolean;
  doneAt: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface ActivityEntry {
  id: string;
  actorName: string;
  action: string;
  detail: string | null;
  applied: boolean;
  at: string;
}

export interface ClinicAccount {
  id: string;
  slug: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  notes: string | null;
  status: AccountStatus;
  plan: PlanTier;
  featureOverrides: Record<string, boolean> | null;
  monthlyFee: string | null;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  startedAt: string | null;
  renewsAt: string | null;
  publicDomain: string | null;
  portalDomain: string | null;
  apiDomain: string | null;
  neonProjectId: string | null;
  provisionedAt: string | null;
  createdAt: string;
}

export interface AccountListItem extends ClinicAccount {
  progress: { done: number; total: number };
  lastHealth: HealthCheck | null;
}

export interface AccountDetail {
  account: ClinicAccount & {
    steps: OnboardingStep[];
    activity: ActivityEntry[];
    health: HealthCheck[];
  };
  features: string[];
}

export interface FeatureSpec {
  key: string;
  label: string;
  description: string;
  from: PlanTier;
  /** Whether the clinic API actually gates on this today. The rest are
   * descriptive — promising one of those in a sales call would be a promise
   * the software does not keep. */
  enforced: boolean;
}

export interface Meta {
  plans: PlanTier[];
  statuses: AccountStatus[];
  features: FeatureSpec[];
  suggestedFees: Record<PlanTier, number>;
  onboardingTemplate: { key: string; label: string; automated: boolean; hint: string }[];
  provisioning: { neon: boolean; vercel: boolean; dryRun: boolean };
  /** The domain clinic subdomains hang off, e.g. "yourco.in". */
  platformDomain?: string;
  /** Whether a queued provisioning job would actually be picked up.
   *  False means the host runner is missing or not sharing the queue,
   *  in which case provisioning would hang at "Queued" forever. */
  queue?: { ok: true } | { ok: false; reason: string };
}

export interface ProvisionStep {
  key: string;
  label: string;
  status: 'ok' | 'skipped' | 'failed' | 'dry-run';
  detail: string;
  wouldCall?: string;
  durationMs?: number;
}

export interface ProvisionOutcome {
  dryRun: boolean;
  steps: ProvisionStep[];
  adminPassword?: string;
}

/**
 * Which badge variant each status gets.
 *
 * Visual weight follows the exception, not the norm. LIVE is the
 * expected state for a healthy account and stays quiet; SUSPENDED and
 * CHURNED are what should catch the eye when scanning fifty rows. A list
 * where every row is coloured gives the eye nowhere to rest.
 */
export const STATUS_VARIANT: Record<AccountStatus, 'default' | 'outline' | 'success' | 'warning' | 'destructive' | 'primary'> = {
  LEAD: 'outline',
  ONBOARDING: 'primary',
  LIVE: 'success',
  SUSPENDED: 'warning',
  CHURNED: 'destructive',
};

export const PLAN_VARIANT: Record<PlanTier, 'default' | 'outline'> = {
  BASIC: 'outline',
  STANDARD: 'outline',
  PREMIUM: 'default',
};

export function money(value: string | number | null, currency = 'INR'): string {
  const n = Number(value ?? 0);
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
