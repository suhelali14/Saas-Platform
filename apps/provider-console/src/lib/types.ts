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

export const STATUS_STYLE: Record<AccountStatus, string> = {
  LEAD: 'bg-white/10 text-gray-300',
  ONBOARDING: 'bg-amber-500/15 text-amber-400',
  LIVE: 'bg-emerald-500/15 text-emerald-400',
  SUSPENDED: 'bg-red-500/15 text-red-400',
  CHURNED: 'bg-white/5 text-gray-500',
};

export const PLAN_STYLE: Record<PlanTier, string> = {
  BASIC: 'bg-white/10 text-gray-300',
  STANDARD: 'bg-blue-500/15 text-blue-400',
  PREMIUM: 'bg-purple-500/15 text-purple-400',
};

export function money(value: string | number | null, currency = 'INR'): string {
  const n = Number(value ?? 0);
  const symbol = currency === 'INR' ? '₹' : '';
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
