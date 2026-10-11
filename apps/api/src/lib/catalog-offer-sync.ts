import type { Business, Product, Service } from "@prisma/client";
import { prisma } from "./prisma.js";
import { indexOffer, removeOfferFromIndex } from "../services/vector/offer-embedding.service.js";

// Catalog -> Offer-embedding flywheel hook (unify-platform Phase 4): a
// business that has opted into the Intently marketplace
// (`intentlyEnabled: true`) gets every catalog Product/Service it creates
// mirrored into a real `Offer` row and indexed for semantic matching --
// otherwise a business's real catalog would never actually be
// discoverable by a consumer's intent, defeating the point of unifying
// the two systems. Businesses that haven't opted in are left untouched
// (no Offer created), matching Intently's opt-in marketplace model.

async function upsertOffer(business: Business, key: "productId" | "serviceId", refId: string, price: number, description: string) {
  const existing = await prisma.offer.findUnique({ where: { [key]: refId } as { productId: string } | { serviceId: string } });

  const offer = existing
    ? await prisma.offer.update({ where: { id: existing.id }, data: { price: Math.round(price), description } })
    : await prisma.offer.create({ data: { businessId: business.id, [key]: refId, price: Math.round(price), description } as never });

  await indexOffer(business, offer);
}

export async function syncProductOffer(business: Business, product: Product): Promise<void> {
  if (!business.intentlyEnabled) return;
  if (!product.isActive) {
    await removeProductOffer(product.id);
    return;
  }
  await upsertOffer(business, "productId", product.id, product.price, product.description || product.name);
}

export async function syncServiceOffer(business: Business, service: Service): Promise<void> {
  if (!business.intentlyEnabled) return;
  if (!service.isActive) {
    await removeServiceOffer(service.id);
    return;
  }
  await upsertOffer(business, "serviceId", service.id, service.price, service.description || service.name);
}

// Only removes the search-index entry, never the Offer row itself -- a
// real consumer Match/Transaction may already reference this offerId
// (Offer.id is a hard, non-cascading FK target for both), so deleting the
// row would either throw a foreign-key violation or silently orphan
// match history. Making it unsearchable is enough to stop new matches.
export async function removeProductOffer(productId: string): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { productId } });
  if (!offer) return;
  await removeOfferFromIndex(offer.id);
}

export async function removeServiceOffer(serviceId: string): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { serviceId } });
  if (!offer) return;
  await removeOfferFromIndex(offer.id);
}
