export type BusinessVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface Business {
  id: string;
  name: string;
  categories: string[];
  city: string;
  address?: string | null;
  location?: { lat: number; lng: number } | null;
  verificationStatus: BusinessVerificationStatus;
  ratingAverage: number;
  verifiedTransactionCount: number;
  // BusinessOS's subscription tier (unify-platform Phase 1 merge -- was
  // `subscriptionTier`, a loose Intently-only string; superseded by this,
  // the real BusinessOS PlanType).
  plan: string;
  razorpayKeyId?: string | null;
  createdAt: string;
}

// Business Dashboard signup form (docs/14-mvp-implementation-plan.md M6) --
// "name, categories, city, one offer" in a single submission. `offer` is
// optional at the type level (a business can theoretically exist without an
// offer yet) but the dashboard form requires it, since a business with zero
// offers can never actually appear in a match.
export interface CreateBusinessRequest {
  name: string;
  categories: string[];
  city: string;
  address?: string;
  offer?: {
    price: number;
    currency?: string;
    description: string;
  };
}

export interface CreateOfferRequest {
  price: number;
  currency?: string;
  description: string;
}

// Real, honest signal for the dashboard list/detail views: how many times
// an offer from this business has actually been surfaced in someone's
// match list. Not "revenue" or "conversions" -- those need the Transaction
// Service (Phase 2, not built), so the dashboard home page's stat cards
// stay as placeholders rather than showing a fabricated number.
export interface BusinessWithStats extends Business {
  matchCount: number;
}
