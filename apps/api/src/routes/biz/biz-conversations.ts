import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ChannelType, ConversationStatus, MessageDirection, MessageType, Prisma, SenderType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { getPaginationParams, createPaginatedResult } from "../../lib/pagination.js";

// Ported from SAAS/backend/src/modules/conversation (unify-platform Phase 3),
// the Universal Inbox.

const sendMessageSchema = z.object({
  content: z.string().min(1),
  type: z.nativeEnum(MessageType).optional(),
  mediaUrl: z.string().optional(),
});

const updateStatusSchema = z.object({ status: z.nativeEnum(ConversationStatus) });
const assignSchema = z.object({ employeeId: z.string() });

/**
 * Finds the open/waiting conversation for a customer on a channel, or opens
 * a new one. Not wired to any route yet -- exported for biz-whatsapp (and
 * any future inbound channel) to call when a message arrives, same as
 * SAAS's original usage.
 */
export async function getOrCreateConversation(
  businessId: string,
  customerId: string,
  channelType: ChannelType,
  externalId?: string,
) {
  const existing = await prisma.conversation.findFirst({
    where: { businessId, customerId, channelType, status: { in: ["OPEN", "WAITING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: { businessId, customerId, channelType, externalId: externalId ?? null, status: "OPEN" },
  });
}

interface AddMessageInput {
  senderType: SenderType;
  direction?: MessageDirection;
  content: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaType?: string;
  aiInterpretation?: Prisma.InputJsonValue;
  aiResponse?: boolean;
  externalId?: string;
  sentByUserId?: string;
}

/**
 * Creates a message and bumps the parent conversation's lastMessageAt/
 * messageCount/unreadCount. Exported for biz-whatsapp (inbound customer
 * messages + AI replies don't go through the authenticated POST /messages
 * route below, which is business-reply-only).
 */
export async function addMessage(conversationId: string, data: AddMessageInput) {
  const isCustomer = data.senderType === "CUSTOMER";
  const direction = data.direction ?? (isCustomer ? "INBOUND" : "OUTBOUND");

  const [message] = await Promise.all([
    prisma.message.create({
      data: {
        conversationId,
        content: data.content,
        direction,
        senderType: data.senderType,
        type: data.type ?? "TEXT",
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        aiInterpretation: data.aiInterpretation,
        aiResponse: data.aiResponse ?? false,
        externalId: data.externalId,
        sentByUserId: data.sentByUserId,
        status: isCustomer ? "DELIVERED" : "SENT",
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: isCustomer ? "OPEN" : undefined,
        unreadCount: isCustomer ? { increment: 1 } : undefined,
      },
    }),
  ]);

  return message;
}

export async function bizConversationRoutes(app: FastifyInstance) {
  app.get("/api/biz/conversations/stats", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const [open, waiting, resolved, closed, totalUnread] = await Promise.all([
      prisma.conversation.count({ where: { businessId: auth.businessId, status: "OPEN" } }),
      prisma.conversation.count({ where: { businessId: auth.businessId, status: "WAITING" } }),
      prisma.conversation.count({ where: { businessId: auth.businessId, status: "RESOLVED" } }),
      prisma.conversation.count({ where: { businessId: auth.businessId, status: "CLOSED" } }),
      prisma.conversation.aggregate({
        where: { businessId: auth.businessId, status: { in: ["OPEN", "WAITING"] } },
        _sum: { unreadCount: true },
      }),
    ]);

    return { open, waiting, resolved, closed, totalUnread: totalUnread._sum.unreadCount ?? 0 };
  });

  app.get("/api/biz/conversations", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const query = request.query as Record<string, string | undefined>;
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Record<string, unknown> = { businessId: auth.businessId };
    if (query.status) where.status = query.status;
    if (query.channelType) where.channelType = query.channelType;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.search) {
      where.OR = [
        { customer: { name: { contains: query.search, mode: "insensitive" } } },
        { customer: { phone: { contains: query.search } } },
        { subject: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, avatar: true, segment: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, senderType: true, createdAt: true, status: true, readAt: true },
          },
        },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        skip,
        take,
      }),
      prisma.conversation.count({ where }),
    ]);

    return createPaginatedResult(conversations, total, page, limit);
  });

  app.get("/api/biz/conversations/:id", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const conversation = await prisma.conversation.findFirst({
      where: { id, businessId: auth.businessId },
      include: { customer: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return reply.status(404).send({ error: "Not found" });
    return conversation;
  });

  app.post("/api/biz/conversations/:id/messages", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({ where: { id, businessId: auth.businessId } });
    if (!conv) return reply.status(404).send({ error: "Not found" });

    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const d = parsed.data;

    // A business-side reply, so senderType is always USER here (customer-
    // originated messages arrive via biz-whatsapp/other channel webhooks,
    // not this endpoint).
    const message = await addMessage(id, {
      senderType: "USER",
      direction: "OUTBOUND",
      content: d.content,
      type: d.type,
      mediaUrl: d.mediaUrl,
      sentByUserId: auth.businessUserId,
    });

    return reply.status(201).send(message);
  });

  app.patch("/api/biz/conversations/:id/status", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({ where: { id, businessId: auth.businessId } });
    if (!conv) return reply.status(404).send({ error: "Not found" });

    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { status } = parsed.data;

    return prisma.conversation.update({
      where: { id },
      data: { status, unreadCount: status === "RESOLVED" || status === "CLOSED" ? 0 : undefined },
    });
  });

  app.patch("/api/biz/conversations/:id/assign", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({ where: { id, businessId: auth.businessId } });
    if (!conv) return reply.status(404).send({ error: "Not found" });

    const parsed = assignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const employee = await prisma.employee.findFirst({ where: { id: parsed.data.employeeId, businessId: auth.businessId } });
    if (!employee) return reply.status(404).send({ error: "Employee not found" });

    return prisma.conversation.update({
      where: { id },
      data: { assignedToId: parsed.data.employeeId, status: "WAITING" },
    });
  });

  app.post("/api/biz/conversations/:id/read", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const { id } = request.params as { id: string };
    const conv = await prisma.conversation.findFirst({ where: { id, businessId: auth.businessId } });
    if (!conv) return reply.status(404).send({ error: "Not found" });

    await Promise.all([
      prisma.message.updateMany({
        where: { conversationId: id, direction: "INBOUND", readAt: null },
        data: { readAt: new Date(), status: "READ" },
      }),
      prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } }),
    ]);

    return { message: "Messages marked as read" };
  });
}
