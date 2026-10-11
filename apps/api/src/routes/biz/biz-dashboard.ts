import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { percentageChange } from "../../lib/analytics-utils.js";

// Ported from SAAS/backend/src/modules/dashboard (unify-platform Phase 3).
// The low-stock raw SQL referenced SAAS's own unmapped table name
// ("InventoryItem") -- same real-table-name fix as biz-inventory.ts's
// low-stock query, not just quoting.

export async function bizDashboardRoutes(app: FastifyInstance) {
  app.get("/api/biz/dashboard/overview", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const businessId = auth.businessId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
    const lastWeekStart = new Date(weekStart.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: todayStart } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: weekStart } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: lastWeekStart, lt: weekStart } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: monthStart } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, createdAt: { gte: lastMonthStart, lt: monthStart } }, _sum: { total: true }, _count: true }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.customer.count({ where: { businessId, createdAt: { gte: monthStart } } }),
      prisma.conversation.count({ where: { businessId, status: { in: ["OPEN", "WAITING"] } } }),
      prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int as count FROM "inventory_items"
        WHERE "businessId" = ${businessId}
          AND quantity <= "lowStockThreshold"
      `,
      prisma.order.findMany({
        where: { businessId },
        include: { customer: { select: { name: true, phone: true, avatar: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.analyticsEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.product.findMany({
        where: { businessId, isActive: true },
        orderBy: { totalSold: "desc" },
        take: 5,
        select: { id: true, name: true, price: true, totalSold: true, images: true },
      }),
      prisma.customer.groupBy({ by: ["segment"], where: { businessId }, _count: true }),
    ]);

    const todayRevenue = todayOrders._sum.total ?? 0;
    const yesterdayRevenue = yesterdayOrders._sum.total ?? 0;
    const weekRevenue = weekOrders._sum.total ?? 0;
    const lastWeekRevenue = lastWeekOrders._sum.total ?? 0;
    const monthRevenue = monthOrders._sum.total ?? 0;
    const lastMonthRevenue = lastMonthOrders._sum.total ?? 0;

    return {
      revenue: {
        today: { amount: todayRevenue, change: percentageChange(todayRevenue, yesterdayRevenue) },
        week: { amount: weekRevenue, change: percentageChange(weekRevenue, lastWeekRevenue) },
        month: { amount: monthRevenue, change: percentageChange(monthRevenue, lastMonthRevenue) },
      },
      orders: { today: todayOrders._count, week: weekOrders._count, month: monthOrders._count },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
        segments: customerSegments.map((s) => ({ segment: s.segment, count: s._count })),
      },
      conversations: { active: activeConversations },
      inventory: { lowStockCount: lowStockItems[0]?.count ?? 0 },
      recentOrders,
      topProducts,
      recentActivity,
    };
  });
}
