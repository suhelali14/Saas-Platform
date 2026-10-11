import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import { syncProductOffer, syncServiceOffer, removeProductOffer, removeServiceOffer } from "../../lib/catalog-offer-sync.js";

// Ported from SAAS/backend/src/modules/catalog (unify-platform Phase 3).
// SAAS's create/update accepted `data: any` with manual `parseFloat`/
// `parseInt` coercion on every numeric field; replaced with zod schemas
// that coerce the same way (`z.coerce.number()`), same effect, type-safe.

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional(),
  costPrice: z.coerce.number().positive().optional(),
  taxRate: z.coerce.number().optional(),
  images: z.array(z.string()).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  searchTerms: z.array(z.string()).optional(),
  trackInventory: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  initialStock: z.coerce.number().int().optional(),
  lowStockThreshold: z.coerce.number().int().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const createServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  duration: z.coerce.number().int().positive().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function bizCatalogRoutes(app: FastifyInstance) {
  // ── Products ──────────────────────────────────────────────────────────
  app.get("/api/biz/catalog/products", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = {
      businessId: auth.businessId,
      isActive: query.isActive !== undefined ? query.isActive === "true" : true,
    };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
        { searchTerms: { has: query.search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          inventory: { select: { quantity: true, lowStockThreshold: true } },
          variants: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    return createPaginatedResult(products, total, page, limit);
  });

  app.get("/api/biz/catalog/products/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const product = await prisma.product.findFirst({
      where: { id, businessId: auth.businessId },
      include: {
        category: true,
        inventory: { include: { movements: { orderBy: { createdAt: "desc" }, take: 10 } } },
        variants: true,
      },
    });
    if (!product) return reply.status(404).send({ error: "Not found" });
    return product;
  });

  app.post("/api/biz/catalog/products", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const product = await prisma.$transaction(async (tx) => {
      const prod = await tx.product.create({
        data: {
          businessId: auth.businessId,
          name: d.name,
          slug: uniqueSlug(d.name),
          description: d.description,
          price: d.price,
          compareAtPrice: d.compareAtPrice,
          costPrice: d.costPrice,
          taxRate: d.taxRate,
          images: d.images ?? [],
          sku: d.sku,
          barcode: d.barcode,
          categoryId: d.categoryId ?? null,
          tags: d.tags ?? [],
          searchTerms: d.searchTerms ?? [],
          trackInventory: d.trackInventory !== false,
          hasVariants: d.hasVariants ?? false,
        },
      });

      // Auto-create the inventory row, matching SAAS's original behavior --
      // a trackInventory product with no InventoryItem would silently break
      // stock displays/low-stock alerts later.
      if (prod.trackInventory) {
        await tx.inventoryItem.create({
          data: {
            businessId: auth.businessId,
            productId: prod.id,
            quantity: d.initialStock ?? 0,
            lowStockThreshold: d.lowStockThreshold ?? 10,
            costPerUnit: d.costPrice,
          },
        });
      }

      return prod;
    });

    // Catalog -> Offer-embedding flywheel (fire-and-forget, same
    // non-blocking pattern as the other Phase-4 hooks -- a slow/failed
    // embed call shouldn't block the catalog write itself).
    prisma.business.findUnique({ where: { id: auth.businessId } }).then((business) => {
      if (business) syncProductOffer(business, product).catch((err) => console.warn("[catalog-offer-sync] index failed (non-critical):", err));
    });

    return reply.status(201).send(product);
  });

  app.put("/api/biz/catalog/products/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.product.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: d.name,
        description: d.description,
        price: d.price,
        compareAtPrice: d.compareAtPrice,
        taxRate: d.taxRate,
        images: d.images,
        sku: d.sku,
        categoryId: d.categoryId,
        tags: d.tags,
        searchTerms: d.searchTerms,
        isActive: d.isActive,
      },
    });

    prisma.business.findUnique({ where: { id: auth.businessId } }).then((business) => {
      if (business) syncProductOffer(business, updated).catch((err) => console.warn("[catalog-offer-sync] index failed (non-critical):", err));
    });

    return updated;
  });

  app.delete("/api/biz/catalog/products/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.product.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    // Soft delete, matching SAAS's original behavior (products link to
    // OrderItem history that must survive).
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    removeProductOffer(id).catch((err) => console.warn("[catalog-offer-sync] de-index failed (non-critical):", err));
    return { message: "Product deactivated" };
  });

  // ── Categories ────────────────────────────────────────────────────────
  app.get("/api/biz/catalog/categories", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    return prisma.category.findMany({
      where: { businessId: auth.businessId },
      include: { children: true, _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
  });

  app.post("/api/biz/catalog/categories", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const category = await prisma.category.create({
      data: {
        businessId: auth.businessId,
        name: d.name,
        slug: uniqueSlug(d.name),
        description: d.description,
        parentId: d.parentId ?? null,
        sortOrder: d.sortOrder ?? 0,
      },
    });
    return reply.status(201).send(category);
  });

  // ── Services ──────────────────────────────────────────────────────────
  app.get("/api/biz/catalog/services", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { skip, take, page, limit } = getPaginationParams(request.query as Record<string, string | undefined>);
    const where = { businessId: auth.businessId, isActive: true };

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.service.count({ where }),
    ]);

    return createPaginatedResult(services, total, page, limit);
  });

  app.post("/api/biz/catalog/services", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = createServiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const service = await prisma.service.create({
      data: {
        businessId: auth.businessId,
        name: d.name,
        slug: uniqueSlug(d.name),
        description: d.description,
        price: d.price,
        duration: d.duration,
        categoryId: d.categoryId ?? null,
        tags: d.tags ?? [],
      },
    });

    prisma.business.findUnique({ where: { id: auth.businessId } }).then((business) => {
      if (business) syncServiceOffer(business, service).catch((err) => console.warn("[catalog-offer-sync] index failed (non-critical):", err));
    });

    return reply.status(201).send(service);
  });

  app.put("/api/biz/catalog/services/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.service.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const parsed = updateServiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const updated = await prisma.service.update({
      where: { id },
      data: { name: d.name, description: d.description, price: d.price, duration: d.duration, isActive: d.isActive },
    });

    prisma.business.findUnique({ where: { id: auth.businessId } }).then((business) => {
      if (business) syncServiceOffer(business, updated).catch((err) => console.warn("[catalog-offer-sync] index failed (non-critical):", err));
    });

    return updated;
  });

  app.delete("/api/biz/catalog/services/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.service.findFirst({ where: { id, businessId: auth.businessId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await prisma.service.update({ where: { id }, data: { isActive: false } });
    removeServiceOffer(id).catch((err) => console.warn("[catalog-offer-sync] de-index failed (non-critical):", err));
    return { message: "Service deactivated" };
  });
}
