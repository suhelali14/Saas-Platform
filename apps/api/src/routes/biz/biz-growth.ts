import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CustomerSegment } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";

// Ported from SAAS/backend/src/modules/growth (unify-platform Phase 3).
// Two real-data fixes vs. SAAS's original:
// (1) segment counts and recentCampaigns fell back to hardcoded numbers/a
//     fake campaign list when real data was zero -- removed, real `count()`
//     is never null so no fallback was ever needed.
// (2) launchBroadcastCampaign marked every campaign COMPLETED and invented
//     sentCount/deliveredCount/readCount (80% of target) as if messages had
//     actually gone out over WhatsApp -- but no WhatsApp send integration
//     exists yet (biz-whatsapp is still unbuilt). Simulating a successful
//     send that never happened is worse than the display-fallback bugs
//     elsewhere: it would show a business real "68 people read your
//     campaign" for zero real messages. Fixed to create the campaign as
//     DRAFT with a real targetCount and sentCount/deliveredCount/readCount
//     left at their real default of 0 -- those become real once
//     biz-whatsapp can actually send.

export interface CampaignTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  suggestedSegment: string;
}

const PREBUILT_CAMPAIGNS: CampaignTemplate[] = [
  {
    id: "diwali-mega-sale",
    name: "Festive Mega Discount Offer",
    category: "Festive & Seasonal",
    message: "Namaste {{name}}! Celebrate the festive season with FLAT 20% OFF on all orders above ₹499. Use Code: FESTIVE20 at checkout or reply here to order!",
    suggestedSegment: "VIP",
  },
  {
    id: "weekend-grocery-refill",
    name: "Weekend Grocery Refill Reminder",
    category: "Retention",
    message: "Hi {{name}}! Ready for the weekend? Stock up on fresh staples, dairy & snacks with 30-min doorstep delivery. Tap here to view our fresh catalog: {{store_url}}",
    suggestedSegment: "ACTIVE",
  },
  {
    id: "we-miss-you-reactivation",
    name: "We Miss You -- 15% Comeback Treat",
    category: "Win-back",
    message: "Hey {{name}}, we noticed you have not ordered in a while! Here is a special ₹100 discount coupon just for you: COMEBACK100 on orders above ₹399. Valid till Sunday!",
    suggestedSegment: "AT_RISK",
  },
  {
    id: "new-product-drop",
    name: "New Arrivals & Exclusive Catalog",
    category: "Product Launch",
    message: "Hello {{name}}! We just added exciting new items to our store catalog! Check them out with special introductory prices today: {{store_url}}",
    suggestedSegment: "ALL",
  },
];

const broadcastSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  targetSegment: z.union([z.nativeEnum(CustomerSegment), z.literal("ALL")]),
});

export async function bizGrowthRoutes(app: FastifyInstance) {
  app.get("/api/biz/growth", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const [total, vip, active, atRisk, campaigns] = await Promise.all([
      prisma.customer.count({ where: { businessId: auth.businessId } }),
      prisma.customer.count({ where: { businessId: auth.businessId, segment: "VIP" } }),
      prisma.customer.count({ where: { businessId: auth.businessId, segment: "ACTIVE" } }),
      prisma.customer.count({ where: { businessId: auth.businessId, segment: "AT_RISK" } }),
      prisma.campaign.findMany({ where: { businessId: auth.businessId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    return {
      segments: { total, vip, active, atRisk },
      prebuiltCampaigns: PREBUILT_CAMPAIGNS,
      recentCampaigns: campaigns,
      automatedTriggers: [
        { id: "trig-1", name: "Order Confirmation & Live Tracking Link", event: "ORDER_PLACED", active: true, channel: "WHATSAPP" },
        { id: "trig-2", name: "Out for Delivery Dispatch Alert with PIN", event: "DISPATCHED", active: true, channel: "WHATSAPP" },
        { id: "trig-3", name: "2-Hour Abandoned Cart Recovery (+5% Coupon)", event: "CART_ABANDONED", active: true, channel: "WHATSAPP" },
        { id: "trig-4", name: "Post-Delivery 5-Star Rating & Review Request", event: "DELIVERED", active: true, channel: "WHATSAPP" },
      ],
    };
  });

  app.post("/api/biz/growth/broadcast", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = broadcastSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const targetCount = await prisma.customer.count({
      where: { businessId: auth.businessId, ...(d.targetSegment !== "ALL" ? { segment: d.targetSegment } : {}) },
    });

    const campaign = await prisma.campaign.create({
      data: {
        businessId: auth.businessId,
        name: d.name,
        content: d.message,
        channel: "WHATSAPP",
        type: "PROMOTION",
        status: "DRAFT",
        targetSegment: d.targetSegment !== "ALL" ? d.targetSegment : undefined,
        targetCount,
      },
    });

    return reply.status(201).send(campaign);
  });
}
