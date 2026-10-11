import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requirePharmacyAuth } from "../plugins/auth.js";

const NEAR_EXPIRY_DAYS = 30;

const batchSchema = z.object({
  batchNumber: z.string().min(1).max(100),
  expiryDate: z.string().datetime(),
  quantityInHand: z.coerce.number().int().min(0).max(1_000_000),
  reorderThreshold: z.coerce.number().int().min(0).max(100_000).optional(),
  costPrice: z.coerce.number().min(0).max(1_000_000).optional(),
});

export async function clinicInventoryRoutes(app: FastifyInstance) {
  app.get("/api/clinic/drugs/:id/batches", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const batches = await prisma.drugBatch.findMany({ where: { drugId: id }, orderBy: { expiryDate: "asc" } });
    return { data: batches };
  });

  app.post("/api/clinic/drugs/:id/batches", async (request, reply) => {
    const auth = requirePharmacyAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const drug = await prisma.drug.findUnique({ where: { id } });
    if (!drug) return reply.status(404).send({ error: "Drug not found" });

    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const batch = await prisma.drugBatch.create({
      data: {
        drugId: id,
        batchNumber: parsed.data.batchNumber,
        expiryDate: new Date(parsed.data.expiryDate),
        quantityInHand: parsed.data.quantityInHand,
        reorderThreshold: parsed.data.reorderThreshold,
        costPrice: parsed.data.costPrice,
      },
    });
    return reply.status(201).send(batch);
  });

  // 🔴 expired / 🟡 near-expiry (30 days) / 🟠 low-stock -- exactly the
  // three states the user asked for, computed live from current batches.
  //
  // Low stock is evaluated per DRUG, not per batch -- caught live while
  // testing this: a drug with two half-empty batches that together add up
  // to plenty of real stock would otherwise flag as "low" on each batch
  // individually, and a batch that hit exactly 0 (the single most urgent
  // case) was being silently excluded entirely by a blanket `quantityInHand
  // > 0` filter applied to every category. Reorder threshold is stored per
  // batch in this schema but conceptually belongs to the drug -- the
  // highest threshold set on any of the drug's own batches is used as the
  // stand-in for "the reorder point configured for this drug."
  app.get("/api/clinic/inventory/alerts", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const now = new Date();
    const nearExpiryCutoff = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const stockedBatches = await prisma.drugBatch.findMany({
      where: { quantityInHand: { gt: 0 } },
      include: { drug: { select: { id: true, name: true } } },
      orderBy: { expiryDate: "asc" },
    });
    const expired = stockedBatches.filter((b) => b.expiryDate < now);
    const nearExpiry = stockedBatches.filter((b) => b.expiryDate >= now && b.expiryDate <= nearExpiryCutoff);

    const allBatches = await prisma.drugBatch.findMany({
      where: { expiryDate: { gte: now } },
      include: { drug: { select: { id: true, name: true } } },
    });
    const byDrug = new Map<string, typeof allBatches>();
    for (const b of allBatches) {
      if (!byDrug.has(b.drugId)) byDrug.set(b.drugId, []);
      byDrug.get(b.drugId)!.push(b);
    }
    const lowStock = [...byDrug.values()]
      .map((batches) => {
        const totalQuantity = batches.reduce((sum, b) => sum + b.quantityInHand, 0);
        const threshold = Math.max(...batches.map((b) => b.reorderThreshold));
        const soonest = batches.reduce((a, b) => (a.expiryDate < b.expiryDate ? a : b));
        return { ...soonest, quantityInHand: totalQuantity, reorderThreshold: threshold };
      })
      .filter((entry) => entry.quantityInHand <= entry.reorderThreshold)
      .sort((a, b) => a.quantityInHand - b.quantityInHand);

    return { expired, nearExpiry, lowStock };
  });
}
