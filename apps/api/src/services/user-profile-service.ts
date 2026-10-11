import type { IntentRequest } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type CategoryCounts = Record<string, number>;
type CategoryBudgets = Record<string, number>;

/**
 * v0: pure arithmetic, no ML, no dependency on volume. See
 * docs/13-ai-cost-optimization-personalization.md Part 2A and
 * docs/14-mvp-implementation-plan.md M4. The learned UserTasteVector
 * (embedding) is Phase 3+ and needs real transaction history to mean
 * anything -- not built yet.
 */
export async function recordIntentForProfile(intentRequest: IntentRequest): Promise<void> {
  const { userId, category, budgetMax, timingType } = intentRequest;
  if (!category) return;

  const existing = await prisma.userProfile.findUnique({ where: { userId } });

  const categoryAffinity = (existing?.categoryAffinity as CategoryCounts | undefined) ?? {};
  categoryAffinity[category] = (categoryAffinity[category] ?? 0) + 1;

  const avgBudgetByCategory = (existing?.avgBudgetByCategory as CategoryBudgets | undefined) ?? {};
  if (budgetMax != null) {
    const prevAvg = avgBudgetByCategory[category] ?? budgetMax;
    avgBudgetByCategory[category] = Math.round((prevAvg + budgetMax) / 2);
  }

  const preferredTiming = (existing?.preferredTiming as CategoryCounts | undefined) ?? {};
  if (timingType) {
    preferredTiming[timingType] = (preferredTiming[timingType] ?? 0) + 1;
  }

  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, categoryAffinity, avgBudgetByCategory, preferredTiming },
    update: { categoryAffinity, avgBudgetByCategory, preferredTiming },
  });
}
