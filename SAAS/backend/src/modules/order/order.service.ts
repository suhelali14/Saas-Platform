import prisma from '../../lib/prisma';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult } from '../../lib/utils';
import { OrderStatus, OrderSource, DeliveryType } from '@prisma/client';
import { refreshCustomerMetrics } from '../customer/customer.service';

// Order number is generated from DB to survive restarts
async function nextOrderNumber(businessId: string): Promise<string> {
  const last = await prisma.order.findFirst({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  let next = 1001;
  if (last?.orderNumber) {
    const num = parseInt(last.orderNumber.replace('#', ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `#${next}`;
}

export async function getOrders(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { status, search, customerId } = query;

  const where: any = { businessId };
  if (status) where.status = status as OrderStatus;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, avatar: true } },
        items: {
          include: { product: { select: { name: true, images: true } } },
        },
        payments: { select: { status: true, amount: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return createPaginatedResult(orders, total, page, limit);
}

export async function getOrderById(businessId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      items: {
        include: { product: { select: { id: true, name: true, images: true, price: true } } },
      },
      payments: true,
      invoice: true,
    },
  });
  if (!order) throw new NotFoundError('Order');
  return order;
}

export async function createOrder(businessId: string, data: any) {
  if (!data.customerId) throw new ValidationError('Customer is required');
  if (!data.items || data.items.length === 0) throw new ValidationError('Order must have at least one item');

  // Fetch customer
  const customer = await prisma.customer.findFirst({ where: { id: data.customerId, businessId } });
  if (!customer) throw new NotFoundError('Customer');

  // Fetch products + validate stock
  const productIds = data.items.map((i: any) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId },
    include: { inventory: true },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  // Build order items
  let subtotal = 0;
  const orderItems: any[] = [];

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new NotFoundError(`Product ${item.productId}`);
    const qty = parseInt(item.quantity) || 1;
    const unitPrice = parseFloat(item.price) || product.price;
    const total = unitPrice * qty;
    subtotal += total;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      productPrice: unitPrice,
      variantName: item.variantName || null,
      quantity: qty,
      unitPrice,
      total,
      notes: item.notes,
    });
  }

  const taxAmount = data.taxAmount ? parseFloat(data.taxAmount) : 0;
  const deliveryFee = data.deliveryFee ? parseFloat(data.deliveryFee) : 0;
  const discount = data.discount ? parseFloat(data.discount) : 0;
  const total = subtotal + taxAmount + deliveryFee - discount;

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        businessId,
        orderNumber: await nextOrderNumber(businessId),
        customerId: data.customerId,
        status: 'PENDING',
        source: (data.source as OrderSource) || 'MANUAL',
        channelType: data.channelType || null,
        conversationId: data.conversationId || null,
        subtotal,
        taxAmount,
        deliveryFee,
        discount,
        total,
        deliveryType: (data.deliveryType as DeliveryType) || 'PICKUP',
        deliveryAddress: data.deliveryAddress,
        deliveryNotes: data.deliveryNotes,
        notes: data.notes,
        customerNotes: data.customerNotes,
        items: { create: orderItems },
      },
      include: { items: true, customer: true },
    });

    // Deduct inventory
    for (const item of orderItems) {
      const inv = await tx.inventoryItem.findFirst({ where: { productId: item.productId, businessId } });
      if (inv) {
        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: inv.id,
            type: 'ORDER_FULFILLED',
            quantity: -item.quantity,
            reason: `Order ${newOrder.orderNumber}`,
            reference: newOrder.id,
            previousQuantity: inv.quantity,
            newQuantity: inv.quantity - item.quantity,
          },
        });

        // Update product total sold
        await tx.product.update({
          where: { id: item.productId },
          data: { totalSold: { increment: item.quantity } },
        });
      }
    }

    return newOrder;
  });

  // Async: refresh customer metrics
  await refreshCustomerMetrics(businessId, data.customerId).catch(() => {});

  return order;
}

export async function updateStatus(businessId: string, id: string, status: OrderStatus) {
  const order = await prisma.order.findFirst({ where: { id, businessId } });
  if (!order) throw new NotFoundError('Order');

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
    },
    include: { customer: true, items: true },
  });

  return updated;
}

export async function getOrderStats(businessId: string) {
  const [byStatus, todayRevenue, monthRevenue] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      where: { businessId },
      _count: true,
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: {
        businessId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  return { byStatus, todayRevenue, monthRevenue };
}
