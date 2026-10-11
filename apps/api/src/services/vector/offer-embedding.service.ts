/**
 * Offer Embedding Service — embeds business/offer descriptions for semantic matching.
 *
 * Every product/service in the catalog gets embedded and stored so the
 * matching engine can do ANN (approximate nearest neighbour) search instead
 * of the v0 category filter. A semantically rich search means:
 *
 *   "quiet gym with sauna, flexible timing"
 *   → matches "CrossFit + Wellness Studio — steam room, open 6am–10pm"
 *   even if neither used the other's exact words.
 *
 * Per docs/04-multi-agent-design.md (Matching Engine) and
 * docs/13-ai-cost-optimization-personalization.md Part 1.
 *
 * What gets embedded (the "offer text"):
 *   "[Business name] in [city], [categories joined]. [description].
 *    Offers: [offer description]. Price: ₹[min]–[max]."
 *
 * Rules:
 * - outOfStock=true in metadata → matching engine skips this offer
 * - When offer price changes → re-embed (text changes)
 * - When business goes inactive → delete embedding
 */

import { prisma } from "../../lib/prisma.js";
import { embed, toVectorLiteral, EMBEDDING_DIM } from "./embedding.service.js";
import type { Business, Offer } from "@prisma/client";

/** Build the text that gets embedded for a business+offer pair. */
function buildOfferText(business: Business, offer: Offer): string {
  const cats = business.categories.join(", ");
  const city = business.city || "India";
  const price = `₹${offer.price}`;
  return [
    `${business.name} in ${city}, specializing in ${cats}.`,
    offer.description,
    `Price: ${price} INR.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Index (or re-index) a single offer.
 * Called when a business creates or updates an offer.
 */
export async function indexOffer(
  business: Business,
  offer: Offer,
  outOfStock = false,
): Promise<void> {
  const text = buildOfferText(business, offer);
  const embedding = await embed(text);
  const vectorLiteral = toVectorLiteral(embedding);

  const metadata = {
    businessId: business.id,
    offerId: offer.id,
    businessName: business.name,
    city: business.city,
    categories: business.categories,
    price: offer.price,
    outOfStock,
    indexedAt: new Date().toISOString(),
  };

  const existing = await prisma.embeddingRecord.findFirst({
    where: { kind: "BUSINESS_OFFER", refId: offer.id },
  });

  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE embedding_records
       SET vector = $1::vector,
           metadata = $2::jsonb,
           "businessId" = $3,
           "updatedAt" = NOW()
       WHERE id = $4`,
      vectorLiteral,
      JSON.stringify(metadata),
      business.id,
      existing.id,
    );
  } else {
    const record = await prisma.embeddingRecord.create({
      data: {
        kind: "BUSINESS_OFFER",
        refId: offer.id,
        businessId: business.id,
        metadata,
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
 * Mark an offer as out-of-stock so the matching engine skips it.
 * Cheaper than deleting + re-indexing when stock returns.
 */
export async function setOfferStockStatus(
  offerId: string,
  outOfStock: boolean,
): Promise<void> {
  const record = await prisma.embeddingRecord.findFirst({
    where: { kind: "BUSINESS_OFFER", refId: offerId },
  });
  if (!record) return;
  const metadata = { ...(record.metadata as Record<string, unknown>), outOfStock };
  await prisma.embeddingRecord.update({
    where: { id: record.id },
    data: { metadata },
  });
}

/**
 * Remove an offer from the Intently index (when a product is deleted or disabled).
 */
export async function removeOfferFromIndex(offerId: string): Promise<void> {
  await prisma.embeddingRecord.deleteMany({
    where: { kind: "BUSINESS_OFFER", refId: offerId },
  });
}

/**
 * Semantic vector search: find the top-K offers closest to an intent embedding.
 *
 * Returns raw rows with similarity score + metadata.
 * The caller (matching-service.ts v2) combines this with hard filters and
 * the user taste vector boost to produce the final ranked result.
 *
 * Hard filters applied here (before vector comparison):
 * - city match
 * - outOfStock = false
 * - optionally price range
 */
export async function searchOffers(opts: {
  intentEmbedding: number[];
  // Optional: IntentRequest has no city field today (only optional, never-
  // populated lat/lng) -- v0 never filtered on city either. When omitted (or
  // empty), skip the city filter entirely instead of comparing against ""
  // and silently matching zero rows. Wire this up for real once the Intent
  // Understanding Agent actually extracts a location.
  city?: string | null;
  budgetMax?: number | null;
  limit?: number;
}): Promise<
  Array<{
    offerId: string;
    businessId: string;
    similarity: number;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>
> {
  const { intentEmbedding, city, budgetMax, limit = 20 } = opts;
  const vectorLiteral = toVectorLiteral(intentEmbedding);

  // Build WHERE clause dynamically based on optional filters.
  const conditions: string[] = [
    `kind = 'BUSINESS_OFFER'`,
    `(metadata->>'outOfStock')::boolean IS NOT TRUE`,
  ];
  const params: unknown[] = [vectorLiteral];

  if (city) {
    conditions.push(`metadata->>'city' = $${params.length + 1}`);
    params.push(city);
  }

  if (budgetMax != null) {
    conditions.push(`(metadata->>'price')::int <= $${params.length + 1}`);
    params.push(budgetMax);
  }

  const whereClause = conditions.join(" AND ");
  const limitParam = `$${params.length + 1}`;
  params.push(limit);

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      ref_id: string;
      business_id: string;
      metadata: string | Record<string, unknown>;
      similarity: number;
      vector_text: string;
    }>
  >(
    `SELECT "refId" AS ref_id, "businessId" AS business_id, metadata,
            1 - (vector <=> $1::vector) AS similarity,
            vector::text AS vector_text
     FROM embedding_records
     WHERE ${whereClause}
     ORDER BY vector <=> $1::vector
     LIMIT ${limitParam}`,
    ...params,
  );

  return rows.map((r) => ({
    offerId: r.ref_id,
    businessId: r.business_id ?? "",
    similarity: Number(r.similarity),
    // The offer's own embedding -- used by the caller for a real taste-vector
    // comparison (not a stand-in for it).
    embedding: JSON.parse(r.vector_text) as number[],
    metadata:
      typeof r.metadata === "string"
        ? JSON.parse(r.metadata)
        : (r.metadata as Record<string, unknown>),
  }));
}

/**
 * Bulk re-index all existing businesses and their offers.
 * Run once after enabling the vector layer, then incrementally thereafter.
 */
export async function reindexAllOffers(): Promise<{ indexed: number; errors: number }> {
  const businesses = await prisma.business.findMany({
    include: { offers: true },
  });

  let indexed = 0;
  let errors = 0;

  for (const business of businesses) {
    for (const offer of business.offers) {
      try {
        await indexOffer(business, offer);
        indexed++;
      } catch (err) {
        console.error(`[offer-embedding] Failed to index offer ${offer.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[offer-embedding] Reindex complete: ${indexed} indexed, ${errors} errors`);
  return { indexed, errors };
}
