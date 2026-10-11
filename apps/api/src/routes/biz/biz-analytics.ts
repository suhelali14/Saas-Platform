import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";

// Ported from SAAS/backend/src/modules/analytics (unify-platform Phase 3).
// SAAS's original fell back to entirely fabricated numbers for nearly
// every field the moment a query returned zero/null -- grossRevenue,
// totalOrders, channel revenue/percentages, topProducts (a whole hardcoded
// product list), and dailyTrends (never queried at all, just seven
// hardcoded Mon-Sun rows). Rebuilt every field from a real query below;
// `grossMargin` returns `null` (not a fake "26.4%") when no order line
// item has product cost data to compute a real margin from, since this
// schema doesn't capture a historical cost-at-time-of-sale snapshot.

export async function bizAnalyticsRoutes(app: FastifyInstance) {
  app.get("/api/biz/analytics", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const businessId = auth.businessId;
    const query = request.query as Record<string, string | undefined>;
    const rangeDays = Math.min(90, Math.max(1, parseInt(query.range ?? "30", 10) || 30));
    const rangeStart = new Date(Date.now() - rangeDays * 86400000);

    const [
      totalOrders,
      totalRevenue,
      whatsappAgg,
      webAgg,
      posAgg,
      topProducts,
      trends,
      marginRow,
      customersWithOrders,
      repeatCustomers,
    ] = await Promise.all([
      prisma.order.count({ where: { businessId } }),
      prisma.order.aggregate({ where: { businessId, status: { notIn: ["CANCELLED"] } }, _sum: { total: true }, _avg: { total: true } }),
      prisma.order.aggregate({ where: { businessId, source: "WHATSAPP", status: { notIn: ["CANCELLED"] } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, source: "WEBSITE", status: { notIn: ["CANCELLED"] } }, _sum: { total: true }, _count: true }),
      prisma.order.aggregate({ where: { businessId, source: "MANUAL", status: { notIn: ["CANCELLED"] } }, _sum: { total: true }, _count: true }),
      prisma.product.findMany({
        where: { businessId },
        orderBy: { totalSold: "desc" },
        take: 6,
        select: { name: true, price: true, totalSold: true },
      }),
      prisma.$queryRaw<{ day: Date; revenue: number; orders: number }[]>`
        SELECT date_trunc('day', "createdAt") as day,
               COALESCE(SUM(total), 0)::float as revenue,
               COUNT(*)::int as orders
        FROM orders
        WHERE "businessId" = ${businessId}
          AND "createdAt" >= ${rangeStart}
          AND status != 'CANCELLED'
        GROUP BY day
        ORDER BY day ASC
      `,
      prisma.$queryRaw<{ margin_amount: number; revenue_amount: number; items_with_cost: number }[]>`
        SELECT COALESCE(SUM((oi."unitPrice" - p."costPrice") * oi.quantity), 0)::float as margin_amount,
               COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::float as revenue_amount,
               COUNT(*) FILTER (WHERE p."costPrice" IS NOT NULL)::int as items_with_cost
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN products p ON p.id = oi."productId"
        WHERE o."businessId" = ${businessId} AND o.status != 'CANCELLED'
      `,
      prisma.customer.count({ where: { businessId, totalOrders: { gte: 1 } } }),
      prisma.customer.count({ where: { businessId, totalOrders: { gte: 2 } } }),
    ]);

    const grossRevenue = totalRevenue._sum.total ?? 0;
    const margin = marginRow[0];
    const grossMargin =
      margin && margin.items_with_cost > 0 && margin.revenue_amount > 0
        ? Number(((margin.margin_amount / margin.revenue_amount) * 100).toFixed(1))
        : null;
    const repeatRate = customersWithOrders > 0 ? Number(((repeatCustomers / customersWithOrders) * 100).toFixed(1)) : 0;

    const channelRevenue = (agg: typeof whatsappAgg) => agg._sum.total ?? 0;
    const pct = (amount: number) => (grossRevenue > 0 ? Math.round((amount / grossRevenue) * 100) : 0);

    return {
      kpis: {
        grossRevenue,
        totalOrders,
        averageOrderValue: Math.round(totalRevenue._avg.total ?? 0),
        grossMargin,
        repeatRate,
      },
      channels: [
        { name: "WhatsApp Commerce", orders: whatsappAgg._count, revenue: channelRevenue(whatsappAgg), percent: pct(channelRevenue(whatsappAgg)) },
        { name: "AI Storefront Website", orders: webAgg._count, revenue: channelRevenue(webAgg), percent: pct(channelRevenue(webAgg)) },
        { name: "Counter POS / Walk-in", orders: posAgg._count, revenue: channelRevenue(posAgg), percent: pct(channelRevenue(posAgg)) },
      ],
      topProducts: topProducts.map((p) => ({ name: p.name, unitsSold: p.totalSold, revenue: p.totalSold * p.price })),
      dailyTrends: trends.map((t) => ({ date: t.day.toISOString().slice(0, 10), revenue: t.revenue, orders: t.orders })),
    };
  });
}
