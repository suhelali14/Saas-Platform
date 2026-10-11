/**
 * Intent Cache Service — semantic cache for parsed intents.
 *
 * Architecture (per docs/13-ai-cost-optimization-personalization.md Part 1):
 *
 * Write path: called on every successfully parsed intent.
 *   embed(rawText) → store (embedding, structuralParse) in EmbeddingRecord
 *   Marked verified=true when the intent leads to a match/transaction.
 *
 * Read path: called BEFORE the LLM on every new intent parse.
 *   embed(rawText) → cosine search in DB (via raw SQL + pgvector)
 *   > 0.93 similarity → cache hit, return structural parse
 *   0.80–0.93 → partial hit signal (caller uses cheap model)
 *   < 0.80 → full model needed
 *
 * The vector column is added via raw SQL migration (not Prisma schema)
 * because Prisma doesn't support pgvector natively. The embedding_records
 * table itself is Prisma-managed; the vector column is appended in the
 * migration file.
 */

import { prisma } from "../../lib/prisma.js";
import { embed, cosineSimilarity, toVectorLiteral, EMBEDDING_DIM } from "./embedding.service.js";
import type { ParsedIntent } from "../ai/schema.js";

const TAXONOMY_VERSION = "v1"; // bump when supported category list changes

export interface CacheHitResult {
  hit: true;
  similarity: number;
  structuralParse: {
    category: ParsedIntent["category"];
    timingType: ParsedIntent["timingType"];
    timingWindow: ParsedIntent["timingWindow"];
    hardConstraints: string[];
    softPreferences: string[];
  };
}

export interface CacheMissResult {
  hit: false;
  similarity: number; // best similarity found (0 if cache empty)
  tier: "cheap_model" | "full_model";
}

export type CacheLookupResult = CacheHitResult | CacheMissResult;

const CACHE_HIT_THRESHOLD = 0.93;
const CHEAP_MODEL_THRESHOLD = 0.80;

/**
 * Look up a previously parsed intent by semantic similarity.
 * Called before the LLM to potentially skip the expensive inference step.
 */
export async function lookupIntentCache(rawText: string): Promise<CacheLookupResult> {
  const embedding = await embed(rawText);

  // Raw SQL with pgvector <=> operator (cosine distance = 1 - similarity).
  // We fetch top-3 candidates and check structural agreement across them
  // for robustness (per doc 13: cache hit requires structural agreement).
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; metadata: string; hit_count: number; similarity: number }>
  >(
    `SELECT id, metadata, "hitCount" AS hit_count,
            1 - (vector <=> $1::vector) AS similarity
     FROM embedding_records
     WHERE kind = 'INTENT_CACHE'
       AND verified = true
       AND metadata->>'taxonomyVersion' = $2
     ORDER BY vector <=> $1::vector
     LIMIT 3`,
    toVectorLiteral(embedding),
    TAXONOMY_VERSION,
  );

  if (rows.length === 0) {
    return { hit: false, similarity: 0, tier: "full_model" };
  }

  const best = rows[0]!;
  const sim = Number(best.similarity);

  if (sim >= CACHE_HIT_THRESHOLD) {
    // Verify structural agreement across top candidates (guard against false positives).
    const bestMeta =
      typeof best.metadata === "string" ? JSON.parse(best.metadata) : best.metadata;

    if (rows.length >= 2) {
      const second = rows[1]!;
      const secondMeta =
        typeof second.metadata === "string"
          ? JSON.parse(second.metadata)
          : second.metadata;
      if (bestMeta.structuralParse?.category !== secondMeta.structuralParse?.category) {
        // Structural disagreement → not confident enough, use cheap model.
        return { hit: false, similarity: sim, tier: "cheap_model" };
      }
    }

    // Increment hit count (fire-and-forget, don't block the response).
    prisma.embeddingRecord
      .update({ where: { id: best.id }, data: { hitCount: { increment: 1 } } })
      .catch(() => {});

    return {
      hit: true,
      similarity: sim,
      structuralParse: bestMeta.structuralParse,
    };
  }

  return {
    hit: false,
    similarity: sim,
    tier: sim >= CHEAP_MODEL_THRESHOLD ? "cheap_model" : "full_model",
  };
}

/**
 * Write a parsed intent to the cache.
 * Called after a successful LLM parse (with verified=false initially).
 * Marked verified=true when the intent leads to a confirmed match or transaction.
 */
export async function writeIntentCache(
  intentRequestId: string,
  rawText: string,
  parsedIntent: ParsedIntent,
  verified = false,
): Promise<void> {
  const embedding = await embed(rawText);
  const vectorLiteral = toVectorLiteral(embedding);

  const metadata = {
    intentRequestId,
    taxonomyVersion: TAXONOMY_VERSION,
    structuralParse: {
      category: parsedIntent.category,
      timingType: parsedIntent.timingType,
      timingWindow: parsedIntent.timingWindow,
      hardConstraints: parsedIntent.hardConstraints,
      softPreferences: parsedIntent.softPreferences,
    },
  };

  // Upsert by refId (one cache entry per intent request).
  const existing = await prisma.embeddingRecord.findFirst({
    where: { kind: "INTENT_CACHE", refId: intentRequestId },
  });

  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE embedding_records
       SET vector = $1::vector,
           metadata = $2::jsonb,
           verified = $3,
           "updatedAt" = NOW()
       WHERE id = $4`,
      vectorLiteral,
      JSON.stringify(metadata),
      verified,
      existing.id,
    );
  } else {
    // Insert the row via Prisma (no vector yet), then update the vector column.
    const record = await prisma.embeddingRecord.create({
      data: {
        kind: "INTENT_CACHE",
        refId: intentRequestId,
        metadata,
        verified,
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE embedding_records SET vector = $1::vector WHERE id = $2`,
      vectorLiteral,
      record.id,
    );
  }
}

/**
 * Mark a cached intent as verified (i.e., it led to a real match/transaction).
 * Verified entries get more weight in cache hit decisions.
 */
export async function verifyIntentCache(intentRequestId: string): Promise<void> {
  await prisma.embeddingRecord.updateMany({
    where: { kind: "INTENT_CACHE", refId: intentRequestId },
    data: { verified: true },
  });
}
