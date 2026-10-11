import { Request, Response, NextFunction } from 'express';
import {
  getConversations as getConversationsService,
  getConversationById as getConversationByIdService,
  addMessage as addMessageService,
  updateConversationStatus as updateConversationStatusService,
  assignConversation as assignConversationService,
  markMessagesRead as markMessagesReadService,
  getInboxStats as getInboxStatsService,
} from './conversation.service';
import { ConversationStatus, MessageType } from '@prisma/client';

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getConversationsService(req.user!.businessId, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getConversationByIdService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await addMessageService(req.user!.businessId, req.params['id'] as string, {
      senderType: 'USER',
      sentByUserId: req.user!.userId,
      content: req.body.content,
      type: (req.body.type as MessageType) || 'TEXT',
      mediaUrl: req.body.mediaUrl,
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateConversationStatusService(
      req.user!.businessId,
      req.params['id'] as string,
      req.body.status as ConversationStatus
    );
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function assignToEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assignConversationService(
      req.user!.businessId,
      req.params['id'] as string,
      req.body.employeeId
    );
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    await markMessagesReadService(req.user!.businessId, req.params['id'] as string);
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (e) { next(e); }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getInboxStatsService(req.user!.businessId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
