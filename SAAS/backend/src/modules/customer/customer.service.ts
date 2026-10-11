import prisma from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult, slugify } from '../../lib/utils';
import { CustomerSegment } from '@prisma/client';

export async function getCustomers(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { search, segment } = query;

  const where: any = { businessId, isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (segment) where.segment = segment as CustomerSegment;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { lastOrderAt: { sort: 'desc', nulls: 'last' } },
      skip,
      take,
    }),
    prisma.customer.count({ where }),
  ]);

  return createPaginatedResult(customers, total, page, limit);
}

export async function getCustomerById(businessId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, businessId },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: { include: { product: { select: { name: true } } } } },
      },
      conversations: {
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, status: true, channelType: true, lastMessageAt: true },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!customer) throw new NotFoundError('Customer');
  return customer;
}

export async function createCustomer(businessId: string, data: any) {
  const customer = await prisma.customer.create({
    data: {
      businessId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      gender: data.gender,
      preferredLanguage: data.preferredLanguage || 'Hindi',
      tags: data.tags || [],
      notes: data.notes,
    },
  });
  return customer;
}

export async function updateCustomer(businessId: string, id: string, data: any) {
  const existing = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Customer');

  return prisma.customer.update({
    where: { id },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      tags: data.tags,
      notes: data.notes,
      segment: data.segment,
    },
  });
}

export async function deleteCustomer(businessId: string, id: string) {
  const existing = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new NotFoundError('Customer');

  return prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getCustomerSegmentStats(businessId: string) {
  const [segments, totalCustomers, newThisMonth, atRisk, vip] = await Promise.all([
    prisma.customer.groupBy({
      by: ['segment'],
      where: { businessId },
      _count: true,
    }),
    prisma.customer.count({ where: { businessId, isActive: true } }),
    prisma.customer.count({
      where: {
        businessId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.customer.count({ where: { businessId, segment: 'AT_RISK' } }),
    prisma.customer.count({ where: { businessId, segment: 'VIP' } }),
  ]);

  return { segments, totalCustomers, newThisMonth, atRisk, vip };
}

export async function getCustomerOrderTimeline(businessId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) throw new NotFoundError('Customer');

  const orders = await prisma.order.findMany({
    where: { customerId, businessId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { product: { select: { name: true, images: true } } },
      },
      payments: true,
    },
  });

  return orders;
}

// Recalculate customer metrics after each order
export async function refreshCustomerMetrics(businessId: string, customerId: string) {
  const stats = await prisma.order.aggregate({
    where: { customerId, businessId, status: { not: 'CANCELLED' } },
    _sum: { total: true },
    _count: true,
    _avg: { total: true },
    _max: { createdAt: true },
    _min: { createdAt: true },
  });

  const lifetimeValue = stats._sum.total || 0;
  const totalOrders = stats._count;
  const averageOrderValue = stats._avg.total || 0;
  const lastOrderAt = stats._max.createdAt;

  // Auto-segment based on metrics
  let segment: CustomerSegment = 'NEW';
  if (totalOrders >= 10 && lifetimeValue >= 10000) segment = 'VIP';
  else if (totalOrders >= 3) segment = 'LOYAL';
  else if (totalOrders >= 1) segment = 'ACTIVE';

  await prisma.customer.update({
    where: { id: customerId },
    data: { lifetimeValue, totalOrders, averageOrderValue, lastOrderAt, segment },
  });
}
