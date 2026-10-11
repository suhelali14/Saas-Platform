import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { getOrCreateConversation, addMessage } from "../routes/biz/biz-conversations.js";
import { orchestrate } from "./ai-orchestrator.js";

// Ported from SAAS/backend/src/modules/whatsapp/whatsapp.service.ts.
// Uses native fetch instead of axios (Node 22, already the runtime here)
// rather than adding another HTTP client dependency.

const WA_API_VERSION = "v19.0";
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp DEMO] Would send to ${to}: "${message}"`);
    return;
  }

  await fetch(`${WA_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: message },
    }),
  });
}

export async function sendWhatsAppTemplate(to: string, templateName: string, parameters: string[]): Promise<void> {
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[WhatsApp DEMO] Would send template "${templateName}" to ${to}`);
    return;
  }

  await fetch(`${WA_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: "en" }, components: [{ type: "body", parameters: parameters.map((p) => ({ type: "text", text: p })) }] },
    }),
  });
}

export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) return challenge;
  return null;
}

interface WhatsAppWebhookBody {
  entry?: Array<{ changes?: Array<{ value?: WhatsAppWebhookValue }> }>;
}

interface WhatsAppWebhookValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string } }>;
  messages?: Array<{ from: string; id: string; type: string; text?: { body?: string } }>;
}

export async function processWebhookEntry(businessId: string, body: WhatsAppWebhookBody): Promise<void> {
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value || value.messaging_product !== "whatsapp") return;

    const messages = value.messages;
    if (!messages || messages.length === 0) return;

    for (const waMessage of messages) {
      const fromPhone = waMessage.from;
      const messageText = waMessage.text?.body || waMessage.type;
      const externalId = waMessage.id;

      let customer = await prisma.customer.findFirst({ where: { businessId, phone: fromPhone } });
      if (!customer) {
        const contactName = value.contacts?.[0]?.profile?.name || `WhatsApp ${fromPhone.slice(-4)}`;
        customer = await prisma.customer.create({ data: { businessId, name: contactName, phone: fromPhone, preferredLanguage: "Hindi" } });
      }

      const conversation = await getOrCreateConversation(businessId, customer.id, "WHATSAPP", fromPhone);

      await addMessage(conversation.id, { senderType: "CUSTOMER", direction: "INBOUND", content: messageText, externalId });

      const history = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { senderType: true, content: true },
      });
      const formattedHistory = history.slice(-8).map((m) => ({ role: (m.senderType === "CUSTOMER" ? "user" : "assistant") as "user" | "assistant", content: m.content }));

      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, type: true } });

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

      await addMessage(conversation.id, {
        senderType: "AI_AGENT",
        direction: "OUTBOUND",
        content: agentResponse.reply,
        aiResponse: true,
        aiInterpretation: { intent: agentResponse.intent, confidence: agentResponse.confidence, handoffToHuman: agentResponse.handoffToHuman ?? false },
      });

      if (agentResponse.handoffToHuman) {
        await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "WAITING", isAiHandled: false } });
      }

      await sendWhatsAppMessage(fromPhone, agentResponse.reply);
    }
  } catch (error) {
    console.error("[whatsapp] Webhook processing error:", error);
    throw error;
  }
}
