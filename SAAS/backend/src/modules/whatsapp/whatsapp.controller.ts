import { Request, Response, NextFunction } from 'express';
import {
  verifyWebhook,
  processWebhookEntry,
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
} from './whatsapp.service';
import prisma from '../../lib/prisma';

export async function verifyWebhookHandler(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const verifiedChallenge = verifyWebhook(mode, token, challenge);
  if (verifiedChallenge) {
    res.status(200).send(verifiedChallenge);
  } else {
    res.status(403).send('Forbidden');
  }
}

export async function handleWebhookEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Immediate 200 OK acknowledgment to WhatsApp
    res.status(200).send('EVENT_RECEIVED');

    // Find the relevant business or fallback to default business
    const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    let business = null;

    if (phoneNumberId) {
      const channel = await prisma.channel.findFirst({
        where: { type: 'WHATSAPP', config: { path: ['phoneNumberId'], equals: phoneNumberId } },
      });
      if (channel) {
        business = await prisma.business.findUnique({ where: { id: channel.businessId } });
      }
    }

    if (!business) {
      // Fallback to first active business in DB for single-tenant local testing
      business = await prisma.business.findFirst({ where: { isActive: true } });
    }

    if (business) {
      await processWebhookEntry(business.id, req.body);
    }
  } catch (e) {
    console.error('WhatsApp webhook error:', e);
  }
}

export async function sendMessageHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, message } = req.body;
    await sendWhatsAppMessage(to, message);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (e) { next(e); }
}

export async function sendTemplateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, templateName, parameters } = req.body;
    await sendWhatsAppTemplate(to, templateName, parameters || []);
    res.json({ success: true, message: 'Template sent successfully' });
  } catch (e) { next(e); }
}
