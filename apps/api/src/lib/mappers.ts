import type {
  IntentRequest as IntentRequestDTO,
  Business as BusinessDTO,
  BusinessDetail as BusinessDetailDTO,
  BusinessWithStats as BusinessWithStatsDTO,
  Offer as OfferDTO,
  MatchResult as MatchResultDTO,
  IntentMessageDTO,
  FunnelEventDTO,
} from "@intently/shared-types";
import type {
  IntentRequest as IntentRequestRow,
  Business as BusinessRow,
  Offer as OfferRow,
  Match as MatchRow,
  IntentMessage as IntentMessageRow,
  FunnelEvent as FunnelEventRow,
} from "@prisma/client";

// Prisma stores IntentRequest fields flat (for indexing); the wire format
// defined in packages/shared-types nests them (for API ergonomics). See the
// comment at the top of prisma/schema.prisma and docs/06-data-model.md.
export function toIntentRequestDTO(row: IntentRequestRow): IntentRequestDTO {
  return {
    id: row.id,
    userId: row.userId,
    rawText: row.rawText,
    category: row.category,
    location:
      row.locationLat != null && row.locationLng != null
        ? { lat: row.locationLat, lng: row.locationLng, radiusKm: row.radiusKm ?? undefined }
        : null,
    budget:
      row.budgetMin != null || row.budgetMax != null
        ? { min: row.budgetMin, max: row.budgetMax, currency: row.currency }
        : null,
    timing:
      row.timingType != null || row.timingWindow != null
        ? { type: row.timingType, window: row.timingWindow }
        : null,
    hardConstraints: row.hardConstraints,
    softPreferences: row.softPreferences,
    confidence: (row.confidence as IntentRequestDTO["confidence"] | null) ?? undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBusinessDTO(row: BusinessRow): BusinessDTO {
  return {
    id: row.id,
    name: row.name,
    categories: row.categories,
    city: row.city,
    address: row.address,
    location: row.latitude != null && row.longitude != null ? { lat: row.latitude, lng: row.longitude } : null,
    verificationStatus: row.verificationStatus,
    ratingAverage: row.ratingAverage,
    verifiedTransactionCount: row.verifiedTxnCount,
    plan: row.plan,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toOfferDTO(row: OfferRow): OfferDTO {
  return {
    id: row.id,
    businessId: row.businessId,
    intentRequestId: row.intentRequestId,
    price: row.price,
    currency: row.currency,
    description: row.description,
    availabilitySlots: row.availabilitySlots.map((slot) => slot.toISOString()),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBusinessDetailDTO(row: BusinessRow & { offers: OfferRow[] }): BusinessDetailDTO {
  return {
    ...toBusinessDTO(row),
    offers: row.offers.map(toOfferDTO),
  };
}

export function toBusinessWithStatsDTO(row: BusinessRow & { matchCount: number }): BusinessWithStatsDTO {
  return {
    ...toBusinessDTO(row),
    matchCount: row.matchCount,
  };
}

export function toMatchResultDTO(
  row: MatchRow & { offer: OfferRow & { business: BusinessRow } },
): MatchResultDTO {
  return {
    id: row.id,
    rank: row.rank,
    relevanceScore: row.relevanceScore,
    reason: row.reason,
    offer: {
      id: row.offer.id,
      price: row.offer.price,
      currency: row.offer.currency,
      description: row.offer.description,
    },
    business: {
      id: row.offer.business.id,
      name: row.offer.business.name,
      city: row.offer.business.city,
      categories: row.offer.business.categories,
      ratingAverage: row.offer.business.ratingAverage,
      verifiedTransactionCount: row.offer.business.verifiedTxnCount,
    },
  };
}

export function toIntentMessageDTO(row: IntentMessageRow): IntentMessageDTO {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFunnelEventDTO(row: FunnelEventRow): FunnelEventDTO {
  return {
    id: row.id,
    eventType: row.eventType,
    intentRequestId: row.intentRequestId,
    metadata: row.metadata as FunnelEventDTO["metadata"],
    createdAt: row.createdAt.toISOString(),
  };
}
