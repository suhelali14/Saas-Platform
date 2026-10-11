import prisma from '../../lib/prisma';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult } from '../../lib/utils';
import { MovementType } from '@prisma/client';

export async function getInventory(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { search } = query;

  const where: any = { businessId };
  if (search) {
    where.product = { name: { contains: search, mode: 'insensitive' } };
  }

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, price: true, images: true, sku: true } },
      },
      orderBy: { quantity: 'asc' }, // low stock first
      skip,
      take,
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  return createPaginatedResult(items, total, page, limit);
}

export async function getInventoryByProduct(businessId: string, productId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { productId, businessId },
    include: {
      product: true,
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!item) throw new NotFoundError('Inventory item');
  return item;
}

export async function adjustInventoryStock(
  businessId: string,
  productId: string,
  data: { type: MovementType; quantity: number; reason?: string }
) {
  if (!data.quantity || data.quantity === 0) {
    throw new ValidationError('Quantity must be non-zero');
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { productId, businessId },
  });

  if (!item) throw new NotFoundError('Inventory item');

  const delta = data.type === 'STOCK_OUT' || data.type === 'DAMAGED'
    ? -Math.abs(data.quantity)
    : Math.abs(data.quantity);

  const newQty = item.quantity + delta;
  if (newQty < 0) throw new ValidationError('Insufficient stock');

  const [updated] = await Promise.all([
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity: newQty,
        ...(data.type === 'STOCK_IN' ? { lastRestockedAt: new Date() } : {}),
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        type: data.type,
        quantity: delta,
        reason: data.reason,
        previousQuantity: item.quantity,
        newQuantity: newQty,
      },
    }),
  ]);

  return updated;
}

export async function getLowStock(businessId: string) {
  // Find items where quantity <= lowStockThreshold
  const items = await prisma.$queryRaw<any[]>`
    SELECT i.*, p.name AS "productName", p.images AS "productImages", p.price AS "productPrice"
    FROM "InventoryItem" i
    JOIN "Product" p ON p.id = i."productId"
    WHERE i."businessId" = ${businessId}
      AND i.quantity <= i."lowStockThreshold"
    ORDER BY i.quantity ASC
  `;
  return items;
}
