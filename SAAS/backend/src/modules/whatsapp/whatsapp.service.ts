import axios from 'axios';
import prisma from '../../lib/prisma';
import { getOrCreateConversation, addMessage } from '../conversation/conversation.service';
import { orchestrate } from '../ai/orchestrator.service';
import { ChannelType } from '@prisma/client';

const WA_API_VERSION = 'v19.0';
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

// ─── Send WhatsApp Message ────────────────────────────────────────────────────
export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp DEMO] Would send to ${to}: "${message}"`);
    return;
  }

  await axios.post(
    `${WA_BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ─── Verify Webhook ───────────────────────────────────────────────────────────
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'businessos-whatsapp-verify';
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

// ─── Process Incoming Webhook ─────────────────────────────────────────────────
export async function processWebhookEntry(businessId: string, body: any): Promise<void> {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || value.messaging_product !== 'whatsapp') return;

    const messages = value.messages;
    if (!messages || messages.length === 0) return;

    for (const waMessage of messages) {
      const fromPhone = waMessage.from;
      const messageText = waMessage.text?.body || waMessage.type;
      const externalId = waMessage.id;

      // Find or create customer
      let customer = await prisma.customer.findFirst({
        where: { businessId, phone: fromPhone },
      });

      if (!customer) {
        const contactName =
          value.contacts?.[0]?.profile?.name || `WhatsApp ${fromPhone.slice(-4)}`;
        customer = await prisma.customer.create({
          data: {
            businessId,
            name: contactName,
            phone: fromPhone,
            preferredLanguage: 'Hindi',
          },
        });
      }

      // Get or create conversation
      const conversation = await getOrCreateConversation(
        businessId,
        customer.id,
        'WHATSAPP' as ChannelType,
        fromPhone
      );

      // Save incoming customer message
      await addMessage(businessId, conversation.id, {
        senderType: 'CUSTOMER',
        direction: 'INBOUND',
        content: messageText,
        externalId,
      });

      // Get conversation history for AI context
      const history = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { senderType: true, content: true },
      });

      const formattedHistory = history.slice(-8).map((m) => ({
        role: (m.senderType === 'CUSTOMER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

      // Get business info
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, type: true },
      });

      // Orchestrate AI response
      const agentResponse = await orchestrate({
        businessId,
        customerId: customer.id,
        conversationId: conversation.id,
        message: messageText,
        history: formattedHistory,
        customerName: customer.name,
        businessName: business?.name,
        businessType: business?.type,
      });

      // Save AI reply
      await addMessage(businessId, conversation.id, {
        senderType: 'AI_AGENT',
        direction: 'OUTBOUND',
        content: agentResponse.reply,
        aiResponse: true,
        aiInterpretation: {
          intent: agentResponse.intent,
          confidence: agentResponse.confidence,
          handoffToHuman: agentResponse.handoffToHuman,
        },
      });

      // If needs human handoff, update status
      if (agentResponse.handoffToHuman) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'WAITING', isAiHandled: false },
        });
      }

      // Send reply via WhatsApp
      await sendWhatsAppMessage(fromPhone, agentResponse.reply);
    }
  } catch (error) {
    console.error('WhatsApp webhook processing error:', error);
    throw error;
  }
}

// ─── Send Template Message ────────────────────────────────────────────────────
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[]
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp DEMO] Would send template "${templateName}" to ${to}`);
    return;
  }

  await axios.post(
    `${WA_BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: parameters.map((p) => ({ type: 'text', text: p })),
          },
        ],
      },
    },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  );
}
