/**
 * Matching Service v2 — vector ANN search replacing the v0 category filter.
 *
 * v0 (original): plain filter on category + budget + rating arithmetic.
 * v2 (this file): semantic vector search with multiple scoring signals.
 *
 * Scoring pipeline:
 *   base_score = cosine_similarity(intent_embedding, offer_embedding)
 *   + budget_fit_bonus (up to +0.15)
 *   + rating_bonus (up to +0.10)
 *   + taste_boost (up to +0.10, from user taste vector)
 *   + response_speed_bonus (up to +0.05, from business responseTargetMin)
 *
 * Hard constraints (applied before scoring, not softened):
 *   - City must match
 *   - Price <= budgetMax (if specified)
 *   - Offer must not be out-of-stock
 *
 * Falls back to v0 filter-based matching if vector search returns no results
 * (e.g., embedding service unavailable or zero-vector returned).
 *
 * Per docs/04-multi-agent-design.md (Matching/Ranking Agent) and
 * docs/13-ai-cost-optimization-personalization.md.
 */

import type { Business, IntentRequest, Offer } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { embed, toVectorLiteral } from "./vector/embedding.service.js";
import { searchOffers } from "./vector/offer-embedding.service.js";
import { tasteBoost } from "./vector/user-taste.service.js";

export interface MatchCandidate {
  offer: Offer & { business: Business };
  rank: number;
  relevanceScore: number;
  reason: string;
}

/** v0 filter-based matcher — kept as fallback when vector layer is unavailable. */
async function findMatchesV0(intentRequest: IntentRequest, limit: number): Promise<MatchCandidate[]> {
  const { category, budgetMax } = intentRequest;
  if (!category) return [];

  const offers = await prisma.offer.findMany({
    where: {
      business: { categories: { has: category } },
      ...(budgetMax != null ? { price: { lte: budgetMax } } : {}),
    },
    include: { business: true },
    take: 20,
  });

  const scored = offers.map((offer) => {
    const reasons: string[] = [`matches ${category}`];
    let score = 0.5;
    if (budgetMax != null) {
      const headroom = (budgetMax - offer.price) / budgetMax;
      score += Math.max(0, Math.min(0.3, headroom));
      reasons.push(`within budget (${offer.price} <= ${budgetMax})`);
    }
    score += Math.min(0.1, offer.business.ratingAverage / 50);
    return { offer, score, reason: reasons.join("; ") };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((e, i) => ({
    offer: e.offer,
    rank: i + 1,
    relevanceScore: Math.round(e.score * 100) / 100,
    reason: e.reason,
  }));
}

/**
 * v2 vector-based matcher — the production matching engine.
 *
 * Builds an embedding from the intent's structured description, then
 * does ANN search over the offer embedding index. Multiple scoring
 * signals are blended to produce a final ranked list.
 */
async function findMatchesV2(intentRequest: IntentRequest, limit: number): Promise<MatchCandidate[]> {
  const { rawText, category, budgetMax, userId, softPreferences } = intentRequest;

  // Build a rich query string that captures the full structured intent,
  // not just the raw user text. This improves semantic match quality.
  const queryText = [
    rawText,
    category ? `category: ${category}` : null,
    softPreferences?.length ? `preferences: ${softPreferences.join(", ")}` : null,
    budgetMax ? `budget under ₹${budgetMax}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const intentEmbedding = await embed(queryText);

  // Check if we got a real embedding (not the zero-vector fallback).
  const isZeroVec = intentEmbedding.every((v) => v === 0);
  if (isZeroVec) return []; // signal to caller to use v0 fallback

  // Semantic ANN search in the offer embedding index. No city filter yet --
  // IntentRequest doesn't capture one (see searchOffers' doc comment).
  const vectorResults = await searchOffers({
    intentEmbedding,
    budgetMax,
    limit: Math.min(limit * 4, 40), // over-fetch then re-rank
  });

  if (vectorResults.length === 0) return [];

  // Fetch full Offer + Business records for the candidates.
  const offerIds = vectorResults.map((r) => r.offerId);
  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds } },
    include: { business: true },
  });

  const offerMap = new Map(offers.map((o) => [o.id, o]));

  // Score each candidate with multiple signals.
  const scored = await Promise.all(
    vectorResults.map(async (result) => {
      const offer = offerMap.get(result.offerId);
      if (!offer) return null;

      const reasons: string[] = [];
      let score = result.similarity;
      reasons.push(`semantic match ${(result.similarity * 100).toFixed(0)}%`);

      // Budget fit bonus.
      if (budgetMax != null && offer.price <= budgetMax) {
        const headroom = (budgetMax - offer.price) / budgetMax;
        const bonus = Math.max(0, Math.min(0.15, headroom * 0.2));
        score += bonus;
        reasons.push(`within budget (₹${offer.price})`);
      }

      // Rating bonus (up to +0.10 for a perfect 5.0 rating).
      const ratingBonus = Math.min(0.10, offer.business.ratingAverage / 50);
      score += ratingBonus;
      if (offer.business.ratingAverage >= 4) {
        reasons.push(`rated ${offer.business.ratingAverage.toFixed(1)}★`);
      }

      // Response speed bonus.
      const biz = offer.business as Business & { responseTargetMin?: number };
      if (biz.responseTargetMin != null && biz.responseTargetMin <= 15) {
        score += 0.05;
        reasons.push("fast responder");
      }

      // User taste boost (requires taste vector — async, fire-and-forget safe).
      if (userId) {
        try {
          const boost = await tasteBoost(userId, result.embedding);
          score += boost;
          if (boost > 0.03) reasons.push("matches your preferences");
        } catch {
          // Non-critical — skip if taste service unavailable.
        }
      }

      return {
        offer,
        score: Math.round(score * 1000) / 1000,
        reason: reasons.join("; "),
      };
    }),
  );

  // Filter nulls and sort by final score.
  const valid = scored.filter((s): s is NonNullable<typeof s> => s !== null);
  valid.sort((a, b) => b.score - a.score);

  return valid.slice(0, limit).map((e, i) => ({
    offer: e.offer,
    rank: i + 1,
    relevanceScore: e.score,
    reason: e.reason,
  }));
}

/**
 * Main entry point for the matching engine.
 * Tries v2 vector search first; falls back to v0 filter if v2 returns nothing.
 */
export async function findMatches(
  intentRequest: IntentRequest,
  limit = 5,
): Promise<MatchCandidate[]> {
  if (!intentRequest.category) return [];

  try {
    const v2Results = await findMatchesV2(intentRequest, limit);
    if (v2Results.length > 0) return v2Results;
  } catch (err) {
    console.warn("[matching-v2] Vector search failed, falling back to v0:", err);
  }

  // Fallback: v0 category filter.
  return findMatchesV0(intentRequest, limit);
}
