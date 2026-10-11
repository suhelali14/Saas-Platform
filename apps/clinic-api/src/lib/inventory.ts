import { prisma } from "./prisma.js";

/**
 * Best-effort total-unit count from a prescription's `dosage`/`duration`
 * strings -- e.g. "1-0-1" (morning-afternoon-night) over "5 days" = 2/day *
 * 5 = 10 units. Only handles the common digit-dash-digit-dash-digit dosage
 * pattern used throughout this app (matches what doctors actually type here)
 * and a simple "N day(s)/week(s)/month(s)" duration. Returns null rather
 * than guessing when either string doesn't match -- syrups, creams, and
 * free-text dosages ("as needed", "SOS") have no reliable unit count, and a
 * wrong guess would be worse than no auto-deduction for that item.
 */
export function parseQuantityFromDosage(dosage: string, duration: string): number | null {
  const dosageMatch = dosage.trim().match(/^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$/);
  if (!dosageMatch) return null;
  const perDay = Number(dosageMatch[1]) + Number(dosageMatch[2]) + Number(dosageMatch[3]);
  if (perDay <= 0) return null;

  const durationMatch = duration.trim().match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
  if (!durationMatch || !durationMatch[2]) return null;
  const unit = durationMatch[2].toLowerCase();
  const multiplier = unit.startsWith("week") ? 7 : unit.startsWith("month") ? 30 : 1;
  const days = Number(durationMatch[1]) * multiplier;

  return perDay * days;
}

export interface FefoResult {
  decremented: number;
  shortfall: number;
}

/**
 * Decrements stock FEFO (First-Expired-First-Out) -- the real pharmacy
 * dispensing safety standard (see the plan's Phase 4 research): the
 * soonest-expiring non-expired batch is drawn down first, expired batches
 * are never touched. Never throws on insufficient stock -- inventory
 * assists dispensing, it doesn't block patient care; the caller surfaces
 * `shortfall` as a warning instead.
 */
export async function decrementStockFEFO(drugId: string, quantity: number): Promise<FefoResult> {
  const batches = await prisma.drugBatch.findMany({
    where: { drugId, quantityInHand: { gt: 0 }, expiryDate: { gte: new Date() } },
    orderBy: { expiryDate: "asc" },
  });

  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantityInHand, remaining);
    await prisma.drugBatch.update({ where: { id: batch.id }, data: { quantityInHand: batch.quantityInHand - take } });
    remaining -= take;
  }

  return { decremented: quantity - remaining, shortfall: remaining };
}
