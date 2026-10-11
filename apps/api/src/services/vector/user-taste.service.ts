/**
 * User Taste Service — per-user EMA (exponential moving average) taste vector.
 *
 * Each user has a single 768-dim vector representing the "flavor" of
 * offers/businesses they've engaged with positively (opened, compared, booked).
 * Updated via EMA so recent behavior has more weight without thrashing on a
 * single data point.
 *
 * Formula:
 *   new_vector = (1 - α) * old_vector + α * embedding(interacted_offer)
 *   α = 0.2 (default — tune empirically once transaction volume is real)
 *
 * Per docs/13-ai-cost-optimization-personalization.md Part 2.
 *
 * Privacy rules (per docs/09-trust-safety-risk.md):
 * - Requires user opt-in (tastVectorOptIn flag, stored externally)
 * - Never exposed at individual level in any data product
 * - Independently deletable via deleteUserTasteVector()
 * - Auto-expires after 180 days of inactivity
 */

import { prisma } from "../../lib/prisma.js";
import { embed, cosineSimilarity, toVectorLiteral, EMBEDDING_DIM } from "./embedding.service.js";

const EMA_ALPHA = 0.2; // weight of the new interaction vs. accumulated history
const DECAY_DAYS = 180; // auto-expire taste vectors after this many days of inactivity

/**
 * Update a user's taste vector when they positively engage with an offer.
 * Positive engagement = opened an offer detail, compared, or completed a booking.
 *
 * @param userId       - Intently user ID
 * @param offerText    - The text of the offer they engaged with (we re-embed it)
 */
export async function updateUserTaste(userId: string, offerText: string): Promise<void> {
  const offerEmbedding = await embed(offerText);

  const existing = await prisma.embeddingRecord.findFirst({
    where: { kind: "USER_TASTE", refId: userId },
  });

  if (!existing) {
    // Cold start: taste vector = the first interaction embedding.
    const record = await prisma.embeddingRecord.create({
      data: {
        kind: "USER_TASTE",
        refId: userId,
        metadata: {
          interactionCount: 1,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE embedding_records SET vector = $1::vector WHERE id = $2`,
      toVectorLiteral(offerEmbedding),
      record.id,
    );
    return;
  }

  // Fetch current vector value.
  const currentVecRow = await prisma.$queryRawUnsafe<
    Array<{ vector: string }>
  >(
    `SELECT vector::text FROM embedding_records WHERE id = $1`,
    existing.id,
  );

  const currentMeta = existing.metadata as Record<string, unknown>;
  const interactionCount = ((currentMeta.interactionCount as number) || 0) + 1;

  // Parse the current vector from Postgres text representation "[0.1,0.2,...]"
  const rawVec = currentVecRow[0]?.vector;
  if (!rawVec) {
    // No vector stored yet (e.g., pgvector migration not applied) — just store the new one.
    await prisma.$executeRawUnsafe(
      `UPDATE embedding_records SET vector = $1::vector, metadata = $2::jsonb WHERE id = $3`,
      toVectorLiteral(offerEmbedding),
      JSON.stringify({ ...currentMeta, interactionCount, lastUpdated: new Date().toISOString() }),
      existing.id,
    );
    return;
  }

  const currentVec: number[] = JSON.parse(rawVec);

  // EMA: new = (1 - α) * old + α * new
  const updatedVec = currentVec.map(
    (v, i) => (1 - EMA_ALPHA) * v + EMA_ALPHA * offerEmbedding[i]!,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE embedding_records
     SET vector = $1::vector,
         metadata = $2::jsonb,
         "updatedAt" = NOW()
     WHERE id = $3`,
    toVectorLiteral(updatedVec),
    JSON.stringify({
      ...currentMeta,
      interactionCount,
      lastUpdated: new Date().toISOString(),
    }),
    existing.id,
  );
}

/**
 * Get a user's taste vector for use in ranking.
 * Returns null if the user has no taste history yet (cold start).
 */
export async function getUserTasteVector(userId: string): Promise<number[] | null> {
  const row = await prisma.$queryRawUnsafe<Array<{ vector: string }>>(
    `SELECT vector::text FROM embedding_records
     WHERE kind = 'USER_TASTE' AND "refId" = $1
       AND "updatedAt" > NOW() - INTERVAL '${DECAY_DAYS} days'
     LIMIT 1`,
    userId,
  );

  if (!row[0]?.vector) return null;
  return JSON.parse(row[0].vector);
}

/**
 * Calculate how much to boost a candidate offer's score based on
 * proximity to the user's taste vector.
 *
 * Returns a value in [0, 0.10] — a small additive boost to the base score.
 * Never overrides hard constraints (per docs/04-multi-agent-design.md guardrails).
 */
export async function tasteBoost(
  userId: string,
  offerEmbedding: number[],
): Promise<number> {
  const tasteVec = await getUserTasteVector(userId);
  if (!tasteVec) return 0;
  const sim = cosineSimilarity(tasteVec, offerEmbedding);
  // Map similarity [0,1] to boost [0, 0.10]
  return Math.max(0, Math.min(0.10, sim * 0.10));
}

/**
 * Delete a user's taste vector (user-initiated, per privacy controls).
 * Does NOT delete their intent request history — they are independently deletable.
 */
export async function deleteUserTasteVector(userId: string): Promise<void> {
  await prisma.embeddingRecord.deleteMany({
    where: { kind: "USER_TASTE", refId: userId },
  });
}
