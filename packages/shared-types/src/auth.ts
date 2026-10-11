export interface AuthResponse {
  token: string;
  userId: string;
  name?: string | null;
}

export interface MeResponse {
  userId: string;
  name?: string | null;
  email?: string | null;
  // No email means this is an anonymous-device ("guest") account, per
  // docs/14-mvp-implementation-plan.md M5.
  isGuest: boolean;
  // Deterministic, derived from userId -- not a stored/tracked referral
  // program yet (that needs RewardLedgerEntry wiring, doc 06/08 Phase 4).
  // Real and stable per user today, not a placeholder value.
  referralCode: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
