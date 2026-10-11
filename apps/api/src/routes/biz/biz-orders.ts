import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OrderStatus, OrderSource, DeliveryType, ChannelType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";
import { refreshCustomerMetrics } from "./biz-customers.js";

// Ported from SAAS/backend/src/modules/order (unify-platform Phase 3).

const orderItemSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().int().positive().default(1),
  price: z.coerce.number().positive().optional(),
  variantName: z.string().optional(),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  customerId: z.string(),
  items: z.array(orderItemSchema).min(1),
  source: z.nativeEnum(OrderSource).optional(),
  channelType: z.nativeEnum(ChannelType).optional(),
  conversationId: z.string().optional(),
  taxAmount: z.coerce.number().optional(),
  deliveryFee: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  deliveryType: z.nativeEnum(DeliveryType).optional(),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  notes: z.string().optional(),
  customerNotes: z.string().optional(),
});

const updateStatusSchema = z.object({ status: z.nativeEnum(OrderStatus) });

/** Order number generated from the DB so it survives restarts (no in-memory counter). */
async function nextOrderNumber(businessId: string): Promise<string> {
  const last = await prisma.order.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });

  let next = 1001;
  if (last?.orderNumber) {
    const num = parseInt(last.orderNumber.replace("#", ""), 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return `#${next}`;
}

export async function bizOrderRoutes(app: FastifyInstance) {
  app.get("/api/biz/orders", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { businessId: auth.businessId };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: "insensitive" } },
        { customer: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, avatar: true } },
          items: { include: { product: { select: { name: true, images: true } } } },
          payments: { select: { status: true, amount: true, method: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return createPaginatedResult(orders, total, page, limit);
  });

  app.get("/api/biz/orders/stats", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const [byStatus, todayRevenue, monthRevenue] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: { businessId: auth.businessId }, _count: true, _sum: { total: true } }),
      prisma.order.aggregate({
        where: { businessId: auth.businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return { byStatus, todayRevenue, monthRevenue };
  });

  app.get("/api/biz/orders/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { id, businessId: auth.businessId },
      include: {
        customer: true,
        items: { include: { product: { select: { id: true, name: true, images: true, price: true } } } },
        payments: true,
        invoice: true,
      },
    });
    if (!order) return reply.status(404).send({ error: "Not found" });
    return order;
  });

  app.post("/api/biz/orders", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const customer = await prisma.customer.findFirst({ where: { id: d.customerId, businessId: auth.businessId } });
    if (!customer) return reply.status(404).send({ error: "Customer not found" });

    const products = await prisma.product.findMany({
      where: { id: { in: d.items.map((i) => i.productId) }, businessId: auth.businessId },
      include: { inventory: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const orderItems = d.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const unitPrice = item.price ?? product.price;
      const total = unitPrice * item.quantity;
      subtotal += total;
      return {
        productId: product.id,
        productName: product.name,
        productPrice: unitPrice,
        variantName: item.variantName ?? null,
        quantity: item.quantity,
        unitPrice,
        total,
        notes: item.notes,
      };
    });

    if (orderItems.length !== d.items.length) {
      return reply.status(404).send({ error: "One or more products not found" });
    }

    for (const item of orderItems) {
      const product = productMap.get(item.productId)!;
      if (product.trackInventory && product.inventory && product.inventory.quantity < item.quantity) {
        return reply.status(400).send({ error: `Insufficient stock for ${product.name}` });
      }
    }

    const taxAmount = d.taxAmount ?? 0;
    const deliveryFee = d.deliveryFee ?? 0;
    const discount = d.discount ?? 0;
    const total = subtotal + taxAmount + deliveryFee - discount;
    const orderNumber = await nextOrderNumber(auth.businessId);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          businessId: auth.businessId,
          orderNumber,
          customerId: d.customerId,
          status: "PENDING",
          source: d.source ?? "MANUAL",
          channelType: d.channelType,
          conversationId: d.conversationId,
          subtotal,
          taxAmount,
          deliveryFee,
          discount,
          total,
          deliveryType: d.deliveryType ?? "PICKUP",
          deliveryAddress: d.deliveryAddress,
          deliveryNotes: d.deliveryNotes,
          notes: d.notes,
          customerNotes: d.customerNotes,
          items: { create: orderItems },
        },
        include: { items: true, customer: true },
      });

      // Deduct inventory + record the movement + bump totalSold, same as
      // SAAS's original -- an order silently not moving stock would be a
      // real inventory-accuracy bug, not just a missing nice-to-have.
      for (const item of orderItems) {
        const inv = await tx.inventoryItem.findFirst({ where: { productId: item.productId, businessId: auth.businessId } });
        if (inv) {
          await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: { decrement: item.quantity } } });
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: inv.id,
              type: "ORDER_FULFILLED",
              quantity: -item.quantity,
              reason: `Order ${newOrder.orderNumber}`,
              reference: newOrder.id,
              previousQuantity: inv.quantity,
              newQuantity: inv.quantity - item.quantity,
            },
          });
          await tx.product.update({ where: { id: item.productId }, data: { totalSold: { increment: item.quantity } } });
        }
      }

      return newOrder;
    }, { timeout: 15000 });

    await refreshCustomerMetrics(auth.businessId, d.customerId).catch(() => {});

    return reply.status(201).send(order);
  });

  app.patch("/api/biz/orders/:id/status", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const order = await prisma.order.findFirst({ where: { id, businessId: auth.businessId } });
    if (!order) return reply.status(404).send({ error: "Not found" });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
      include: { customer: true, items: true },
    });

    await refreshCustomerMetrics(auth.businessId, order.customerId).catch(() => {});

    return updated;
  });
}
