// Wire shape for GET /api/users/me/profile. v0 structured profile only
// (docs/13-ai-cost-optimization-personalization.md Part 2A) -- the learned
// UserTasteVector embedding is Phase 3+ and has no DTO yet.
export interface UserProfileDTO {
  categoryAffinity: Record<string, number>;
  avgBudgetByCategory: Record<string, number>;
  preferredTiming: Record<string, number>;
  updatedAt: string;
}
