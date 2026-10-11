import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MovementType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Ported from SAAS/backend/src/modules/inventory (unify-platform Phase 3).
// getLowStock's raw SQL referenced SAAS's own unmapped table names
// ("InventoryItem", "Product") -- this schema explicitly @@map's every
// ported model to snake_case (inventory_items, products), so the query is
// rewritten against the real table/column names, not copied verbatim.
const adjustStockSchema = z.object({
  type: z.nativeEnum(MovementType),
  quantity: z.coerce.number().int(),
  reason: z.string().optional(),
});

export async function bizInventoryRoutes(app: FastifyInstance) {
  app.get("/api/biz/inventory", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { businessId: auth.businessId };
    if (query.search) {
      where.product = { name: { contains: query.search, mode: "insensitive" } };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: { product: { select: { id: true, name: true, price: true, images: true, sku: true } } },
        orderBy: { quantity: "asc" }, // low stock first
        skip,
        take,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return createPaginatedResult(items, total, page, limit);
  });

  app.get("/api/biz/inventory/low-stock", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const items = await prisma.$queryRawUnsafe(
      `SELECT i.*, p.name AS "productName", p.images AS "productImages", p.price AS "productPrice"
       FROM "inventory_items" i
       JOIN "products" p ON p.id = i."productId"
       WHERE i."businessId" = $1
         AND i.quantity <= i."lowStockThreshold"
       ORDER BY i.quantity ASC`,
      auth.businessId,
    );
    return items;
  });

  app.get("/api/biz/inventory/:productId", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { productId } = request.params as { productId: string };
    const item = await prisma.inventoryItem.findFirst({
      where: { productId, businessId: auth.businessId },
      include: { product: true, movements: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!item) return reply.status(404).send({ error: "Not found" });
    return item;
  });

  app.post("/api/biz/inventory/:productId/adjust", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { productId } = request.params as { productId: string };
    const parsed = adjustStockSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { type, quantity, reason } = parsed.data;
    if (quantity === 0) {
      return reply.status(400).send({ error: "Quantity must be non-zero" });
    }

    const item = await prisma.inventoryItem.findFirst({ where: { productId, businessId: auth.businessId } });
    if (!item) return reply.status(404).send({ error: "Not found" });

    const delta = type === "STOCK_OUT" || type === "DAMAGED" ? -Math.abs(quantity) : Math.abs(quantity);
    const newQty = item.quantity + delta;
    if (newQty < 0) {
      return reply.status(400).send({ error: "Insufficient stock" });
    }

    const [updated] = await Promise.all([
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: newQty, ...(type === "STOCK_IN" ? { lastRestockedAt: new Date() } : {}) },
      }),
      prisma.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type,
          quantity: delta,
          reason,
          previousQuantity: item.quantity,
          newQuantity: newQty,
        },
      }),
    ]);

    return updated;
  });
}
