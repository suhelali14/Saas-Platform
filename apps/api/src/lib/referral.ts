// Deterministic per-user code, not stored -- avoids a migration for what's
// still a Phase 1 stand-in. Real tracking (who referred whom, reward payout)
// needs RewardLedgerEntry wiring (docs/06-data-model.md, Phase 4 per
// docs/08-business-model-gtm.md) -- not built yet, so this is a stable,
// shareable code and nothing more today.
export function deriveReferralCode(userId: string): string {
  const cleaned = userId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(-8);
}
