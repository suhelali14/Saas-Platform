// Ported from SAAS/backend/src/lib/utils.ts (percentageChange) -- shared
// by biz-dashboard and biz-analytics.
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
