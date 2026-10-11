import prisma from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult, slugify, uniqueSlug } from '../../lib/utils';

// ============================================================
// PRODUCTS
// ============================================================

export async function getProducts(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { search, categoryId, isActive } = query;

  const where: any = { businessId };
  if (isActive !== undefined) where.isActive = isActive === 'true';
  else where.isActive = true;
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { searchTerms: { has: search } },
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
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return createPaginatedResult(products, total, page, limit);
}

export async function getProductById(businessId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, businessId },
    include: {
      category: true,
      inventory: { include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } } },
      variants: true,
    },
  });
  if (!product) throw new NotFoundError('Product');
  return product;
}

export async function createProduct(businessId: string, data: any) {
  const baseSlug = slugify(data.name);

  const product = await prisma.$transaction(async (tx) => {
    const prod = await tx.product.create({
      data: {
        businessId,
        name: data.name,
        slug: uniqueSlug(data.name),
        description: data.description,
        price: parseFloat(data.price),
        compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : null,
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        taxRate: data.taxRate ? parseFloat(data.taxRate) : null,
        images: data.images || [],
        sku: data.sku,
        barcode: data.barcode,
        categoryId: data.categoryId || null,
        tags: data.tags || [],
        searchTerms: data.searchTerms || [],
        trackInventory: data.trackInventory !== false,
        hasVariants: data.hasVariants || false,
      },
    });

    // Auto-create inventory item
    if (prod.trackInventory) {
      await tx.inventoryItem.create({
        data: {
          businessId,
          productId: prod.id,
          quantity: parseInt(data.initialStock) || 0,
          lowStockThreshold: parseInt(data.lowStockThreshold) || 10,
          costPerUnit: data.costPrice ? parseFloat(data.costPrice) : null,
        },
      });
    }

    return prod;
  });

  return product;
}

export async function updateProduct(businessId: string, id: string, data: any) {
  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Product');

  return prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      price: data.price ? parseFloat(data.price) : undefined,
      compareAtPrice: data.compareAtPrice ? parseFloat(data.compareAtPrice) : undefined,
      taxRate: data.taxRate ? parseFloat(data.taxRate) : undefined,
      images: data.images,
      sku: data.sku,
      categoryId: data.categoryId,
      tags: data.tags,
      searchTerms: data.searchTerms,
      isActive: data.isActive,
    },
  });
}

export async function deleteProduct(businessId: string, id: string) {
  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Product');

  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

// ============================================================
// CATEGORIES
// ============================================================

export async function getCategories(businessId: string) {
  return prisma.category.findMany({
    where: { businessId },
    include: { children: true, _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createCategory(businessId: string, data: any) {
  return prisma.category.create({
    data: {
      businessId,
      name: data.name,
      slug: uniqueSlug(data.name),
      description: data.description,
      parentId: data.parentId || null,
      sortOrder: data.sortOrder || 0,
    },
  });
}

// ============================================================
// SERVICES
// ============================================================

export async function getServices(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: { businessId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.service.count({ where: { businessId, isActive: true } }),
  ]);

  return createPaginatedResult(services, total, page, limit);
}

export async function createService(businessId: string, data: any) {
  return prisma.service.create({
    data: {
      businessId,
      name: data.name,
      slug: uniqueSlug(data.name),
      description: data.description,
      price: parseFloat(data.price),
      duration: data.duration ? parseInt(data.duration) : null,
      categoryId: data.categoryId || null,
      tags: data.tags || [],
    },
  });
}

export async function updateService(businessId: string, id: string, data: any) {
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Service');

  return prisma.service.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      price: data.price ? parseFloat(data.price) : undefined,
      duration: data.duration ? parseInt(data.duration) : undefined,
      isActive: data.isActive,
    },
  });
}

export async function deleteService(businessId: string, id: string) {
  const existing = await prisma.service.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Service');
  return prisma.service.update({ where: { id }, data: { isActive: false } });
}
