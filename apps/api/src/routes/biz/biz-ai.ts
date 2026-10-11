import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { orchestrate, classifyIntent } from "../../lib/ai-orchestrator.js";

// Ported from SAAS/backend/src/modules/ai (unify-platform Phase 5 --
// found missing while auditing the frontend's endpoint list against the
// 14 Phase-3 modules; the orchestrator itself was already ported into
// lib/ai-orchestrator.ts for biz-whatsapp, this just exposes it as the
// direct chat-testing endpoint the frontend's AI playground calls).

const chatSchema = z.object({
  message: z.string().min(1),
  customerId: z.string().optional(),
  conversationId: z.string().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
});

const classifySchema = z.object({ message: z.string().optional() });

export async function bizAiRoutes(app: FastifyInstance) {
  app.post("/api/biz/ai/chat", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    const business = await prisma.business.findUnique({ where: { id: auth.businessId }, select: { name: true, type: true } });

    let customerName = "Guest";
    if (d.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: d.customerId, businessId: auth.businessId } });
      if (customer) customerName = customer.name;
    }

    const response = await orchestrate({
      businessId: auth.businessId,
      customerId: d.customerId || "demo-customer",
      conversationId: d.conversationId || "demo-conv",
      message: d.message,
      history: d.history ?? [],
      customerName,
      businessName: business?.name,
      businessType: business?.type,
    });

    return response;
  });

  app.post("/api/biz/ai/classify", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = classifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const intent = classifyIntent(parsed.data.message ?? "");
    return { message: parsed.data.message, intent };
  });
}
