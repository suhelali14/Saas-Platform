/**
 * Intently Bridge Routes — /api/biz/intently/*
 *
 * The integration layer between the Intently consumer marketplace and the
 * BusinessOS SaaS: marketplace settings, demand intelligence, Intently-
 * sourced leads, and channel analytics, all scoped to the authenticated
 * business.
 *
 * Phase 4 fix (unify-platform plan): every handler here used to resolve
 * "the business" via `prisma.business.findFirst({ where: { offers: {
 * some: {} } } })` -- a placeholder that ignored the caller entirely and,
 * in a multi-business dataset, returned an arbitrary business's settings/
 * leads/analytics to whoever asked. It also authenticated with the
 * *consumer* `requireAuth` (a mobile-app `User`), which has no
 * relationship to a `Business` at all -- these are business-owner-facing
 * endpoints that belong behind `requireBizAuth`, same as every other
 * `/api/biz/*` route. Now that Business/BusinessUser are unified
 * (Phase 1) and `requireBizAuth` exists (Phase 2), every handler below
 * uses `auth.businessId` directly.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireBizAuth } from "../plugins/auth.js";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const intentlySettingsSchema = z.object({
  intentlyEnabled: z.boolean(),
  intentlyCategories: z.array(z.string()).optional(),
  intentlyRadius: z.number().positive().optional(),
  intentlyPlan: z.enum(["free", "growth", "intelligence"]).optional(),
  autoAcceptUnder: z.number().int().positive().optional(),
  responseTargetMin: z.number().int().min(5).max(120).optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function intentlyBridgeRoutes(app: FastifyInstance) {

  /**
   * GET /api/biz/intently/settings
   * Returns the Intently marketplace configuration for the authenticated business.
   */
  app.get("/api/biz/intently/settings", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({
      where: { id: auth.businessId },
      select: {
        id: true,
        intentlyEnabled: true,
        intentlyCategories: true,
        intentlyRadius: true,
        intentlyPlan: true,
        autoAcceptUnder: true,
        responseTargetMin: true,
      },
    });

    if (!business) {
      return reply.status(404).send({ error: "Business not found" });
    }

    return {
      intentlyEnabled: business.intentlyEnabled,
      intentlyCategories: business.intentlyCategories,
      intentlyRadius: business.intentlyRadius ?? 5,
      intentlyPlan: business.intentlyPlan,
      autoAcceptUnder: business.autoAcceptUnder,
      responseTargetMin: business.responseTargetMin,
      profileUrl: `https://intently.app/s/${business.id}`,
    };
  });

  /**
   * PUT /api/biz/intently/settings
   * Update Intently marketplace configuration.
   */
  app.put("/api/biz/intently/settings", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = intentlySettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) {
      return reply.status(404).send({ error: "Business not found" });
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        intentlyEnabled: parsed.data.intentlyEnabled,
        intentlyCategories: parsed.data.intentlyCategories ?? business.intentlyCategories,
        intentlyRadius: parsed.data.intentlyRadius,
        intentlyPlan: parsed.data.intentlyPlan,
        autoAcceptUnder: parsed.data.autoAcceptUnder,
        responseTargetMin: parsed.data.responseTargetMin,
      },
    });

    return { success: true, intentlyEnabled: updated.intentlyEnabled };
  });

  /**
   * GET /api/biz/intently/demand
   * Returns aggregated demand intelligence for the business's categories.
   * Phase 1: returns recent intent requests matching their categories (anonymized).
   * Phase 3: returns cluster analysis of unfulfilled demand.
   */
  app.get("/api/biz/intently/demand", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) {
      return reply.status(404).send({ error: "Business not found" });
    }

    // Count recent intents in this business's categories (last 7 days).
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const demandByCategory = await Promise.all(
      business.categories.map(async (cat) => {
        const total = await prisma.intentRequest.count({
          where: {
            category: cat,
            createdAt: { gte: sevenDaysAgo },
          },
        });
        const matched = await prisma.intentRequest.count({
          where: {
            category: cat,
            createdAt: { gte: sevenDaysAgo },
            status: { in: ["MATCHED", "FULFILLED"] },
          },
        });
        const unmatched = total - matched;
        return { category: cat, total, matched, unmatched };
      }),
    );

    // Recent intents in the last 24h (for the live demand feed).
    const recentIntents = await prisma.intentRequest.count({
      where: {
        category: { in: business.categories },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return {
      demandByCategory,
      recentIntentsToday: recentIntents,
      weeklyTotal: demandByCategory.reduce((s, d) => s + d.total, 0),
      unmatchedOpportunity: demandByCategory.reduce((s, d) => s + d.unmatched, 0),
    };
  });

  /**
   * GET /api/biz/intently/leads
   * Returns all Intently-sourced customer leads for this business.
   * Phase 1: returns Match records where the business was matched.
   * Phase 2: returns CRM customer records with source=INTENTLY.
   */
  app.get("/api/biz/intently/leads", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) {
      return reply.status(404).send({ error: "Business not found" });
    }

    // Find recent matches for this business's offers.
    const matches = await prisma.match.findMany({
      where: { offer: { businessId: business.id } },
      include: {
        intentRequest: {
          select: {
            id: true,
            rawText: true,
            category: true,
            budgetMax: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { shownAt: "desc" },
      take: 50,
    });

    const leads = matches.map((m) => ({
      matchId: m.id,
      intentText: m.intentRequest.rawText,
      category: m.intentRequest.category,
      budgetMax: m.intentRequest.budgetMax,
      status: m.intentRequest.status,
      relevanceScore: m.relevanceScore,
      shownAt: m.shownAt,
    }));

    return { leads, total: leads.length };
  });

  /**
   * GET /api/biz/intently/analytics
   * Intently channel analytics — match rate, conversion, revenue.
   */
  app.get("/api/biz/intently/analytics", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const business = await prisma.business.findUnique({ where: { id: auth.businessId } });
    if (!business) {
      return reply.status(404).send({ error: "Business not found" });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalMatches, totalTransactions, revenue] = await Promise.all([
      prisma.match.count({ where: { offer: { businessId: business.id }, shownAt: { gte: thirtyDaysAgo } } }),
      prisma.transaction.count({ where: { businessId: business.id, createdAt: { gte: thirtyDaysAgo }, status: "COMPLETED" } }),
      prisma.transaction.aggregate({
        where: { businessId: business.id, createdAt: { gte: thirtyDaysAgo }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

    const conversionRate = totalMatches > 0 ? (totalTransactions / totalMatches) * 100 : 0;

    return {
      period: "30d",
      totalMatches,
      totalConversions: totalTransactions,
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenue: revenue._sum.amount ?? 0,
      avgOrderValue: totalTransactions > 0 ? Math.round((revenue._sum.amount ?? 0) / totalTransactions) : 0,
    };
  });
}
