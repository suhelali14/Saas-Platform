import { Request, Response, NextFunction } from 'express';
import { orchestrate, classifyIntent } from './orchestrator.service';
import prisma from '../../lib/prisma';

export async function chatWithAI(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user!.businessId;
    const { message, customerId, conversationId, history } = req.body;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, type: true },
    });

    let customerName = 'Guest';
    if (customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
      if (customer) customerName = customer.name;
    }

    const response = await orchestrate({
      businessId,
      customerId: customerId || 'demo-customer',
      conversationId: conversationId || 'demo-conv',
      message,
      history: history || [],
      customerName,
      businessName: business?.name,
      businessType: business?.type,
    });

    res.json({ success: true, data: response });
  } catch (e) { next(e); }
}

export async function testIntentClassifier(req: Request, res: Response, next: NextFunction) {
  try {
    const { message } = req.body;
    const intent = classifyIntent(message || '');
    res.json({ success: true, data: { message, intent } });
  } catch (e) { next(e); }
}
