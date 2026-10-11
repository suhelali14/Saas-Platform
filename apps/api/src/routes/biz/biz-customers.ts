import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CustomerSegment } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Ported from SAAS/backend/src/modules/customer (unify-platform Phase 3).

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gender: z.string().optional(),
  preferredLanguage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  segment: z.nativeEnum(CustomerSegment).optional(),
});

/**
 * Recalculates a customer's lifetime metrics + auto-segment from their
 * order history. Called after every order status change once biz-orders
 * exists (not wired to any route here -- it's the same "recompute after
 * order" hook SAAS's order.service.ts calls internally).
 */
export async function refreshCustomerMetrics(businessId: string, customerId: string): Promise<void> {
  const stats = await prisma.order.aggregate({
    where: { customerId, businessId, status: { not: "CANCELLED" } },
    _sum: { total: true },
    _count: true,
    _avg: { total: true },
    _max: { createdAt: true },
  });

  const lifetimeValue = stats._sum.total ?? 0;
  const totalOrders = stats._count;
  const averageOrderValue = stats._avg.total ?? 0;
  const lastOrderAt = stats._max.createdAt;

  let segment: CustomerSegment = "NEW";
  if (totalOrders >= 10 && lifetimeValue >= 10000) segment = "VIP";
  else if (totalOrders >= 3) segment = "LOYAL";
  else if (totalOrders >= 1) segment = "ACTIVE";

  await prisma.customer.update({
    where: { id: customerId },
    data: { lifetimeValue, totalOrders, averageOrderValue, lastOrderAt, segment },
  });
}

export async function bizCustomerRoutes(app: FastifyInstance) {
  app.get("/api/biz/customers", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { businessId: auth.businessId, isActive: true };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.segment) where.segment = query.segment;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { lastOrderAt: { sort: "desc", nulls: "last" } },
        skip,
        take,
      }),
      prisma.customer.count({ where }),
    ]);

    return createPaginatedResult(customers, total, page, limit);
  });

  app.get("/api/biz/customers/stats", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const [segments, totalCustomers, newThisMonth, atRisk, vip] = await Promise.all([
      prisma.customer.groupBy({ by: ["segment"], where: { businessId: auth.businessId }, _count: true }),
      prisma.customer.count({ where: { businessId: auth.businessId, isActive: true } }),
      prisma.customer.count({
        where: {
          businessId: auth.businessId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.customer.count({ where: { businessId: auth.businessId, segment: "AT_RISK" } }),
      prisma.customer.count({ where: { businessId: auth.businessId, segment: "VIP" } }),
    ]);

    return { segments, totalCustomers, newThisMonth, atRisk, vip };
  });

  app.get("/api/biz/customers/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const customer = await prisma.customer.findFirst({
      where: { id, businessId: auth.businessId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { items: { include: { product: { select: { name: true } } } } },
        },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 3,
          select: { id: true, status: true, channelType: true, lastMessageAt: true },
        },
        payments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!customer) return reply.status(404).send({ error: "Not found" });
    return customer;
  });

  app.get("/api/biz/customers/:id/timeline", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const customer = await prisma.customer.findFirst({ where: { id, businessId: auth.businessId } });
    if (!customer) return reply.status(404).send({ error: "Not found" });

    return prisma.order.findMany({
      where: { customerId: id, businessId: auth.businessId },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: { select: { name: true, images: true } } } },
        payments: true,
      },
    });
  });

  app.post("/api/biz/customers", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const customer = await prisma.customer.create({
      data: {
        businessId: auth.businessId,
        name: d.name,
        phone: d.phone,
        email: d.email,
        address: d.address,
        city: d.city,
        state: d.state,
        pincode: d.pincode,
        gender: d.gender,
        preferredLanguage: d.preferredLanguage ?? "Hindi",
        tags: d.tags ?? [],
        notes: d.notes,
      },
    });
    return reply.status(201).send(customer);
  });

  app.put("/api/biz/customers/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.customer.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = updateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    return prisma.customer.update({ where: { id }, data: parsed.data });
  });

  app.delete("/api/biz/customers/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.customer.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.customer.update({ where: { id }, data: { isActive: false } });
    return { message: "Customer deactivated" };
  });
}
