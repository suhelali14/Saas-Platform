import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SubmitIntentResponse } from "@intently/shared-types";
import type { IntentRequest as IntentRequestRow } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { toIntentRequestDTO, toMatchResultDTO, toIntentMessageDTO } from "../lib/mappers.js";
import { requireAuth } from "../plugins/auth.js";
import { parseIntent, type Clarification } from "../services/intent-service.js";
import { findMatches } from "../services/matching-service.js";
import { recordIntentForProfile } from "../services/user-profile-service.js";
import { generateAssistantReply } from "../services/reply-service.js";
import { recordFunnelEvent } from "../services/funnel-service.js";
import type { ParsedIntent } from "../services/ai/schema.js";
import type { ConversationTurn } from "../services/ai/types.js";
// Vector intelligence write-path (fire-and-forget — never blocks the response).
import { writeIntentCache, verifyIntentCache } from "../services/vector/intent-cache.service.js";
import { recordIntentlyLead } from "../lib/intently-flywheel.js";


const createIntentRequestSchema = z.object({
  rawText: z.string().min(1).max(2000),
});

const refineIntentSchema = z.object({
  content: z.string().min(1).max(2000),
});

// The DB stores our own SUPPORTED_CATEGORIES/timing enum values verbatim
// (written by parseIntent itself), so this cast is a safe internal
// round-trip, not a trust boundary on external input.
function rowToParsedIntent(row: IntentRequestRow): ParsedIntent {
  return {
    category: row.category as ParsedIntent["category"],
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    timingType: row.timingType as ParsedIntent["timingType"],
    timingWindow: row.timingWindow as ParsedIntent["timingWindow"],
    hardConstraints: row.hardConstraints,
    softPreferences: row.softPreferences,
    confidence: (row.confidence as ParsedIntent["confidence"] | null) ?? { category: 0, budget: 0, timing: 0 },
  };
}

/**
 * Shared by the initial submit and every refinement turn (docs/04-multi-agent-design.md
 * "Conversational refinement"): re-run matching against the current
 * (possibly just-refined) intent, replace the old match set, update the
 * profile, post a deterministic assistant reply, and return the full
 * response shape. `intentRequest` must already reflect the latest parsed
 * fields (the caller writes those before calling this).
 */
async function runMatchingAndRespond(
  intentRequest: IntentRequestRow,
  parsed: ParsedIntent,
  previousIntent: ParsedIntent | null,
  clarification: Clarification | null,
  userId: string,
): Promise<SubmitIntentResponse> {
  await prisma.match.deleteMany({ where: { intentRequestId: intentRequest.id } });

  const candidates = await findMatches(intentRequest);

  const persistedMatches = await Promise.all(
    candidates.map(async (candidate) => {
      const match = await prisma.match.create({
        data: {
          intentRequestId: intentRequest.id,
          offerId: candidate.offer.id,
          rank: candidate.rank,
          relevanceScore: candidate.relevanceScore,
          reason: candidate.reason,
        },
      });
      return { match, candidate };
    }),
  );

  await recordIntentForProfile(intentRequest);
  await recordFunnelEvent(userId, "RESULTS_SHOWN", {
    intentRequestId: intentRequest.id,
    metadata: { matchCount: persistedMatches.length },
  });

  // Match -> Customer flywheel (fire-and-forget, same non-blocking pattern
  // as the vector cache write below): each matched business gets a real
  // lead in their own CRM, not just an entry in Intently's own Match table.
  if (persistedMatches.length > 0) {
    const consumer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true, email: true } });
    if (consumer) {
      const uniqueBusinessIds = new Set(persistedMatches.map(({ candidate }) => candidate.offer.business.id));
      for (const businessId of uniqueBusinessIds) {
        recordIntentlyLead(businessId, consumer, `Intently match: "${intentRequest.rawText}"`).catch((err) =>
          console.warn("[intently-flywheel] lead upsert failed (non-critical):", err),
        );
      }
    }
  }

  const hasMatches = persistedMatches.length > 0;
  const newStatus = hasMatches ? "MATCHED" : intentRequest.status;

  // Vector cache write-path (fire-and-forget — non-blocking).
  // Per docs/13-ai-cost-optimization-personalization.md Part 1:
  // verified=true when the intent led to real matches (proxy for correctness).
  writeIntentCache(intentRequest.id, intentRequest.rawText, parsed, hasMatches).catch(
    (err) => console.warn("[intent-cache] write failed (non-critical):", err),
  );
  if (hasMatches) {
    verifyIntentCache(intentRequest.id).catch(() => {});
  }

  if (newStatus !== intentRequest.status) {
    await prisma.intentRequest.update({ where: { id: intentRequest.id }, data: { status: newStatus } });
  }

  const replyContent = generateAssistantReply({
    parsed,
    previousIntent,
    matchCount: persistedMatches.length,
    clarification,
  });
  await prisma.intentMessage.create({
    data: { intentRequestId: intentRequest.id, role: "ASSISTANT", content: replyContent },
  });

  const allMessages = await prisma.intentMessage.findMany({
    where: { intentRequestId: intentRequest.id },
    orderBy: { createdAt: "asc" },
  });

  return {
    intentRequest: toIntentRequestDTO({ ...intentRequest, status: newStatus }),
    matches: persistedMatches.map(({ match, candidate }) => ({
      id: match.id,
      rank: match.rank,
      relevanceScore: match.relevanceScore,
      reason: match.reason,
      offer: {
        id: candidate.offer.id,
        price: candidate.offer.price,
        currency: candidate.offer.currency,
        description: candidate.offer.description,
      },
      business: {
        id: candidate.offer.business.id,
        name: candidate.offer.business.name,
        city: candidate.offer.business.city,
        categories: candidate.offer.business.categories,
        ratingAverage: candidate.offer.business.ratingAverage,
        verifiedTransactionCount: candidate.offer.business.verifiedTxnCount,
      },
    })),
    messages: allMessages.map(toIntentMessageDTO),
    needsClarification: clarification,
  };
}

export async function intentRequestRoutes(app: FastifyInstance) {
  app.post("/api/intent-requests", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsedBody = createIntentRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: parsedBody.error.flatten() });
    }

    const { rawText } = parsedBody.data;
    const { parsed, clarification } = await parseIntent({ turns: [{ role: "user", content: rawText }] });

    const intentRequest = await prisma.intentRequest.create({
      data: {
        userId,
        rawText,
        category: parsed.category,
        budgetMin: parsed.budgetMin,
        budgetMax: parsed.budgetMax,
        timingType: parsed.timingType,
        timingWindow: parsed.timingWindow,
        hardConstraints: parsed.hardConstraints,
        softPreferences: parsed.softPreferences,
        confidence: parsed.confidence,
        status: "OPEN",
      },
    });

    await prisma.intentMessage.create({
      data: { intentRequestId: intentRequest.id, role: "USER", content: rawText },
    });
    await recordFunnelEvent(userId, "INTENT_SUBMITTED", { intentRequestId: intentRequest.id });

    const response = await runMatchingAndRespond(intentRequest, parsed, null, clarification, userId);
    return reply.status(201).send(response);
  });

  // Conversational refinement turn (docs/04-multi-agent-design.md, docs/14-mvp-implementation-plan.md):
  // re-parses using the full thread + previously understood fields, so
  // "under 1500 instead" merges with the category/location already
  // established rather than starting over.
  app.post("/api/intent-requests/:id/messages", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };
    const existing = await prisma.intentRequest.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return reply.status(404).send({ error: "Not found" });
    }

    const parsedBody = refineIntentSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: parsedBody.error.flatten() });
    }
    const { content } = parsedBody.data;

    const history = await prisma.intentMessage.findMany({
      where: { intentRequestId: id },
      orderBy: { createdAt: "asc" },
    });

    const turns: ConversationTurn[] = [
      ...history.map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      { role: "user" as const, content },
    ];

    const previousIntent = rowToParsedIntent(existing);
    const { parsed, clarification } = await parseIntent({ turns, previousIntent });

    await prisma.intentMessage.create({
      data: { intentRequestId: id, role: "USER", content },
    });

    const updated = await prisma.intentRequest.update({
      where: { id },
      data: {
        category: parsed.category,
        budgetMin: parsed.budgetMin,
        budgetMax: parsed.budgetMax,
        timingType: parsed.timingType,
        timingWindow: parsed.timingWindow,
        hardConstraints: parsed.hardConstraints,
        softPreferences: parsed.softPreferences,
        confidence: parsed.confidence,
      },
    });

    const response = await runMatchingAndRespond(updated, parsed, previousIntent, clarification, userId);
    return reply.status(200).send(response);
  });

  app.get("/api/intent-requests", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const intentRequests = await prisma.intentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return intentRequests.map(toIntentRequestDTO);
  });

  app.get("/api/intent-requests/:id", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };
    const intentRequest = await prisma.intentRequest.findUnique({ where: { id } });
    if (!intentRequest || intentRequest.userId !== userId) {
      return reply.status(404).send({ error: "Not found" });
    }

    const matches = await prisma.match.findMany({
      where: { intentRequestId: id },
      include: { offer: { include: { business: true } } },
      orderBy: { rank: "asc" },
    });

    const messages = await prisma.intentMessage.findMany({
      where: { intentRequestId: id },
      orderBy: { createdAt: "asc" },
    });

    const response: SubmitIntentResponse = {
      intentRequest: toIntentRequestDTO(intentRequest),
      matches: matches.map(toMatchResultDTO),
      messages: messages.map(toIntentMessageDTO),
    };
    return response;
  });
}
