import prisma from '../../lib/prisma';
import { percentageChange } from '../../lib/utils';

export async function getDashboardOverview(businessId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Run all queries in parallel
  const [
    todayOrders,
    yesterdayOrders,
    weekOrders,
    lastWeekOrders,
    monthOrders,
    lastMonthOrders,
    totalCustomers,
    newCustomersThisMonth,
    activeConversations,
    lowStockItems,
    recentOrders,
    recentActivity,
    topProducts,
    customerSegments,
  ] = await Promise.all([
    // Today's orders
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: todayStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Yesterday's orders
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: yesterdayStart, lt: todayStart } },
      _sum: { total: true },
      _count: true,
    }),
    // This week
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: weekStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Last week
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: lastWeekStart, lt: weekStart } },
      _sum: { total: true },
      _count: true,
    }),
    // This month
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Last month
    prisma.order.aggregate({
      where: { businessId, createdAt: { gte: lastMonthStart, lt: monthStart } },
      _sum: { total: true },
      _count: true,
    }),
    // Total customers
    prisma.customer.count({ where: { businessId, isActive: true } }),
    // New customers this month
    prisma.customer.count({
      where: { businessId, createdAt: { gte: monthStart } },
    }),
    // Active conversations
    prisma.conversation.count({
      where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
    }),
    // Low stock items (quantity <= lowStockThreshold)
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::int as count FROM "InventoryItem"
      WHERE "businessId" = ${businessId}
        AND quantity <= "lowStockThreshold"
    `,
    // Recent orders
    prisma.order.findMany({
      where: { businessId },
      include: { customer: { select: { name: true, phone: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Recent analytics events
    prisma.analyticsEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Top products by sales
    prisma.product.findMany({
      where: { businessId, isActive: true },
      orderBy: { totalSold: 'desc' },
      take: 5,
      select: { id: true, name: true, price: true, totalSold: true, images: true },
    }),
    // Customer segments
    prisma.customer.groupBy({
      by: ['segment'],
      where: { businessId },
      _count: true,
    }),
  ]);

  const todayRevenue = todayOrders._sum.total || 0;
  const yesterdayRevenue = yesterdayOrders._sum.total || 0;
  const weekRevenue = weekOrders._sum.total || 0;
  const lastWeekRevenue = lastWeekOrders._sum.total || 0;
  const monthRevenue = monthOrders._sum.total || 0;
  const lastMonthRevenue = lastMonthOrders._sum.total || 0;

  return {
    revenue: {
      today: { amount: todayRevenue, change: percentageChange(todayRevenue, yesterdayRevenue) },
      week: { amount: weekRevenue, change: percentageChange(weekRevenue, lastWeekRevenue) },
      month: { amount: monthRevenue, change: percentageChange(monthRevenue, lastMonthRevenue) },
    },
    orders: {
      today: todayOrders._count,
      week: weekOrders._count,
      month: monthOrders._count,
    },
    customers: {
      total: totalCustomers,
      newThisMonth: newCustomersThisMonth,
      segments: customerSegments.map((s) => ({
        segment: s.segment,
        count: s._count,
      })),
    },
    conversations: {
      active: activeConversations,
    },
    inventory: {
      lowStockCount: Number((lowStockItems as any)[0]?.count ?? 0),
    },
    recentOrders,
    topProducts,
    recentActivity,
  };
}
