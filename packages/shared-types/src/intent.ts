// Wire-format DTOs for the Intent -> Match -> Offer flow.
// See docs/06-data-model.md for the canonical shape and docs/04-multi-agent-design.md
// for how IntentRequest gets produced by the Intent Understanding Agent.

import type { Business } from "./business";

export type IntentRequestStatus = "OPEN" | "MATCHED" | "FULFILLED" | "EXPIRED";

export interface IntentRequestConfidence {
  category?: number;
  location?: number;
  budget?: number;
  timing?: number;
}

export interface IntentRequest {
  id: string;
  userId: string;
  rawText: string;
  category?: string | null;
  location?: { lat: number; lng: number; radiusKm?: number } | null;
  budget?: { min?: number | null; max?: number | null; currency: string } | null;
  timing?: { type?: string | null; window?: string | null } | null;
  hardConstraints: string[];
  softPreferences: string[];
  confidence?: IntentRequestConfidence;
  status: IntentRequestStatus;
  createdAt: string;
}

export interface Offer {
  id: string;
  businessId: string;
  intentRequestId?: string | null;
  price: number;
  currency: string;
  description: string;
  availabilitySlots: string[];
  expiresAt?: string | null;
  createdAt: string;
}

export interface Match {
  id: string;
  intentRequestId: string;
  offerId: string;
  rank: number;
  relevanceScore: number;
  reason?: string | null;
  shownAt: string;
}

// What the mobile Results screen actually renders per candidate -- a Match
// joined with just enough of its Offer and Business to display a card.
// v0 matcher (docs/14-mvp-implementation-plan.md M1) is plain Prisma
// filtering, not vector search, so `reason` is a short template string for
// now, not an LLM-generated explanation.
export interface MatchResult {
  id: string;
  rank: number;
  relevanceScore: number;
  reason?: string | null;
  offer: Pick<Offer, "id" | "price" | "currency" | "description">;
  business: Pick<Business, "id" | "name" | "city" | "categories" | "ratingAverage" | "verifiedTransactionCount" | "razorpayKeyId">;
}

export interface Clarification {
  field: "category" | "budget";
  question: string;
}

// The refinement chat thread for one IntentRequest -- see
// docs/04-multi-agent-design.md "Conversational refinement" and
// apps/api/src/services/ai/types.ts. Every IntentRequest has at least one
// USER message (the original text) and one ASSISTANT message (a
// deterministic summary of what was understood), from creation onward.
export interface IntentMessageDTO {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

export interface SubmitIntentResponse {
  intentRequest: IntentRequest;
  matches: MatchResult[];
  messages: IntentMessageDTO[];
  needsClarification?: Clarification | null;
}
