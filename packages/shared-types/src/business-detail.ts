// Separate file (not merged into business.ts) to avoid a cycle: this needs
// both Business and Offer, and intent.ts already imports Business.
import type { Business } from "./business";
import type { Offer } from "./intent";

export interface BusinessDetail extends Business {
  offers: Offer[];
}
