import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toBusinessDTO, toBusinessDetailDTO, toBusinessWithStatsDTO, toOfferDTO } from "../lib/mappers.js";
import { indexOffer } from "../services/vector/offer-embedding.service.js";


const offerSchema = z.object({
  price: z.number().int().positive(),
  currency: z.string().min(1).optional(),
  description: z.string().min(1),
});

const createBusinessSchema = z.object({
  name: z.string().min(1),
  categories: z.array(z.string()).min(1),
  city: z.string().min(1),
  address: z.string().min(1).optional(),
  // Business Dashboard signup form (docs/14-mvp-implementation-plan.md M6)
  // submits name/categories/city + one offer in a single request -- a
  // business with zero offers can never appear in a match, so the
  // dashboard form requires this even though the API itself allows a bare
  // business record (curl/seed scripts still need that).
  offer: offerSchema.optional(),
});

async function withMatchCount(businessId: string): Promise<number> {
  return prisma.match.count({ where: { offer: { businessId } } });
}

export async function businessRoutes(app: FastifyInstance) {
  app.get("/api/businesses", async () => {
    const businesses = await prisma.business.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const withStats = await Promise.all(
      businesses.map(async (business) => ({ ...business, matchCount: await withMatchCount(business.id) })),
    );
    return withStats.map(toBusinessWithStatsDTO);
  });

  app.get("/api/businesses/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const business = await prisma.business.findUnique({ where: { id }, include: { offers: true } });
    if (!business) {
      return reply.status(404).send({ error: "Not found" });
    }
    return toBusinessDetailDTO(business);
  });

  app.post("/api/businesses", async (request, reply) => {
    const parsed = createBusinessSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { offer, ...businessFields } = parsed.data;

    const business = await prisma.business.create({
      data: {
        ...businessFields,
        offers: offer
          ? {
              create: {
                price: offer.price,
                currency: offer.currency ?? "INR",
                description: offer.description,
              },
            }
          : undefined,
      },
      include: { offers: true },
    });

    // Index the initial offer for semantic vector matching (fire-and-forget).
    if (business.offers.length > 0) {
      business.offers.forEach((o) =>
        indexOffer(business, o).catch((err) =>
          console.warn("[offer-embedding] index failed (non-critical):", err),
        ),
      );
    }

    return reply.status(201).send(toBusinessDetailDTO(business));
  });

  app.post("/api/businesses/:id/offers", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.business.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Not found" });
    }

    const parsed = offerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const offer = await prisma.offer.create({
      data: {
        businessId: id,
        price: parsed.data.price,
        currency: parsed.data.currency ?? "INR",
        description: parsed.data.description,
      },
    });

    // Index new offer for semantic vector matching (fire-and-forget).
    indexOffer(existing, offer).catch((err) =>
      console.warn("[offer-embedding] index failed (non-critical):", err),
    );

    return reply.status(201).send(toOfferDTO(offer));
  });
}
