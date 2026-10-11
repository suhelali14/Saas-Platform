import prisma from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { getPaginationParams, createPaginatedResult } from '../../lib/utils';
import { ChannelType, ConversationStatus, MessageDirection, SenderType, MessageType } from '@prisma/client';

export async function getConversations(businessId: string, query: any) {
  const { skip, take, page, limit } = getPaginationParams(query);
  const { status, channelType, search, assignedToId } = query;

  const where: any = { businessId };
  if (status) where.status = status as ConversationStatus;
  if (channelType) where.channelType = channelType as ChannelType;
  if (assignedToId) where.assignedToId = assignedToId;
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, avatar: true, segment: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, senderType: true, createdAt: true, status: true, readAt: true },
        },
      },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      skip,
      take,
    }),
    prisma.conversation.count({ where }),
  ]);

  return createPaginatedResult(conversations, total, page, limit);
}

export async function getConversationById(businessId: string, id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id, businessId },
    include: {
      customer: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!conversation) throw new NotFoundError('Conversation');
  return conversation;
}

export async function getOrCreateConversation(
  businessId: string,
  customerId: string,
  channelType: ChannelType,
  externalId?: string
) {
  const existing = await prisma.conversation.findFirst({
    where: {
      businessId,
      customerId,
      channelType,
      status: { in: ['OPEN', 'WAITING'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      businessId,
      customerId,
      channelType,
      externalId: externalId || null,
      status: 'OPEN',
    },
  });
}

export async function addMessage(
  businessId: string,
  conversationId: string,
  data: {
    senderType: SenderType;
    direction?: MessageDirection;
    content: string;
    type?: MessageType;
    mediaUrl?: string;
    mediaType?: string;
    aiInterpretation?: any;
    aiResponse?: boolean;
    externalId?: string;
    sentByUserId?: string;
  }
) {
  const isCustomer = data.senderType === 'CUSTOMER';
  const direction = data.direction || (isCustomer ? 'INBOUND' : 'OUTBOUND');

  const [message] = await Promise.all([
    prisma.message.create({
      data: {
        conversationId,
        content: data.content,
        direction,
        senderType: data.senderType,
        type: data.type || 'TEXT',
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        aiInterpretation: data.aiInterpretation,
        aiResponse: data.aiResponse || false,
        externalId: data.externalId,
        sentByUserId: data.sentByUserId,
        status: isCustomer ? 'DELIVERED' : 'SENT',
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        status: isCustomer ? 'OPEN' : undefined,
        unreadCount: isCustomer ? { increment: 1 } : undefined,
      },
    }),
  ]);

  return message;
}

export async function updateConversationStatus(
  businessId: string,
  id: string,
  status: ConversationStatus
) {
  const conv = await prisma.conversation.findFirst({ where: { id, businessId } });
  if (!conv) throw new NotFoundError('Conversation');

  return prisma.conversation.update({
    where: { id },
    data: {
      status,
      unreadCount: status === 'RESOLVED' || status === 'CLOSED' ? 0 : undefined,
    },
  });
}

export async function assignConversation(
  businessId: string,
  id: string,
  employeeId: string
) {
  const conv = await prisma.conversation.findFirst({ where: { id, businessId } });
  if (!conv) throw new NotFoundError('Conversation');

  return prisma.conversation.update({
    where: { id },
    data: { assignedToId: employeeId, status: 'WAITING' },
  });
}

export async function markMessagesRead(businessId: string, conversationId: string) {
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, businessId } });
  if (!conv) throw new NotFoundError('Conversation');

  await Promise.all([
    prisma.message.updateMany({
      where: { conversationId, direction: 'INBOUND', readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    }),
  ]);
}

export async function getInboxStats(businessId: string) {
  const [open, waiting, resolved, closed, totalUnread] = await Promise.all([
    prisma.conversation.count({ where: { businessId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { businessId, status: 'WAITING' } }),
    prisma.conversation.count({ where: { businessId, status: 'RESOLVED' } }),
    prisma.conversation.count({ where: { businessId, status: 'CLOSED' } }),
    prisma.conversation.aggregate({
      where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
      _sum: { unreadCount: true },
    }),
  ]);

  return {
    open,
    waiting,
    resolved,
    closed,
    totalUnread: totalUnread._sum?.unreadCount ?? 0,
  };
}
