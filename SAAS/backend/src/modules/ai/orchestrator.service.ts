import OpenAI from 'openai';
import prisma from '../../lib/prisma';

// ─── Intent Types ────────────────────────────────────────────────────────────
export type MessageIntent =
  | 'ORDER_INQUIRY'
  | 'PLACE_ORDER'
  | 'CATALOG_BROWSE'
  | 'PRICE_CHECK'
  | 'COMPLAINT'
  | 'DELIVERY_STATUS'
  | 'PAYMENT_QUERY'
  | 'GENERAL_INQUIRY'
  | 'GREETING'
  | 'APPOINTMENT_BOOK'
  | 'FEEDBACK'
  | 'UNSUBSCRIBE';

export interface AgentContext {
  businessId: string;
  customerId: string;
  conversationId: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  customerName?: string;
  businessName?: string;
  businessType?: string;
}

export interface AgentResponse {
  reply: string;
  intent: MessageIntent;
  confidence: number;
  actions?: Array<{ type: string; data: any }>;
  suggestedReplies?: string[];
  handoffToHuman?: boolean;
}

// ─── OpenAI Client (optional) ────────────────────────────────────────────────
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  return new OpenAI({ apiKey });
}

// ─── Intent Classifier ───────────────────────────────────────────────────────
export function classifyIntent(message: string): MessageIntent {
  const lower = message.toLowerCase().trim();

  if (/\b(hi|hello|hey|namaste|jai|hola|good morning|good evening|howdy)\b/i.test(lower)) return 'GREETING';
  if (/\b(order|buy|purchase|chahiye|mujhe|bhejo|send|book)\b/i.test(lower)) return 'PLACE_ORDER';
  if (/\b(status|where|track|kahan|delivered|delivery|kitna time)\b/i.test(lower)) return 'DELIVERY_STATUS';
  if (/\b(price|rate|kitne|cost|how much|rate batao|charges)\b/i.test(lower)) return 'PRICE_CHECK';
  if (/\b(catalog|menu|list|products|kya hai|kya milta|items|show)\b/i.test(lower)) return 'CATALOG_BROWSE';
  if (/\b(complaint|problem|issue|wrong|bad|kharab|return|refund)\b/i.test(lower)) return 'COMPLAINT';
  if (/\b(payment|paid|pay|upi|gpay|paytm|cash|due|balance)\b/i.test(lower)) return 'PAYMENT_QUERY';
  if (/\b(appointment|book|slot|time|schedule|visit|milna)\b/i.test(lower)) return 'APPOINTMENT_BOOK';
  if (/\b(stop|unsubscribe|band karo|mat bhejo|remove)\b/i.test(lower)) return 'UNSUBSCRIBE';
  if (/\b(feedback|review|rating|experience|good|excellent|love)\b/i.test(lower)) return 'FEEDBACK';
  if (/\b(my order|mera order|order number|#)\b/i.test(lower)) return 'ORDER_INQUIRY';

  return 'GENERAL_INQUIRY';
}

// ─── Context Builder ─────────────────────────────────────────────────────────
async function buildBusinessContext(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, type: true, phone: true, city: true, workingHours: true, paymentMethods: true },
  });

  if (!business) return '';

  return `You are an AI assistant for "${business.name}", a ${business.type?.replace(/_/g, ' ')} located in ${business.city || 'India'}.
Your role is to help customers with their queries in a friendly, helpful way.
Keep responses concise (under 150 words). Use simple language. Mix Hindi/English naturally if appropriate.
Payment methods accepted: ${business.paymentMethods?.join(', ') || 'Cash, UPI'}.
Working hours: ${business.workingHours ? JSON.stringify(business.workingHours) : '9 AM - 9 PM'}.
Always be polite, professional, and helpful. If you cannot help, offer to connect them with the owner.`;
}

// ─── AI Response Generator ───────────────────────────────────────────────────
async function generateAIResponse(
  context: AgentContext,
  intent: MessageIntent,
  systemPrompt: string
): Promise<string> {
  const openai = getOpenAIClient();

  if (openai) {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...context.history.slice(-8), // last 4 exchanges
        { role: 'user', content: context.message },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || fallbackResponse(intent, context);
    } catch (err) {
      console.error('OpenAI error, using fallback:', err);
    }
  }

  return fallbackResponse(intent, context);
}

// ─── Rule-Based Fallback Responses ───────────────────────────────────────────
function fallbackResponse(intent: MessageIntent, context: AgentContext): string {
  const name = context.customerName || 'there';
  const biz = context.businessName || 'our store';

  const responses: Record<MessageIntent, string[]> = {
    GREETING: [
      `Hi ${name}! 👋 Welcome to ${biz}. How can I help you today?`,
      `Namaste ${name}! 🙏 Welcome to ${biz}. What can I do for you?`,
    ],
    CATALOG_BROWSE: [
      `Here's what we have available at ${biz}! 📦 Type the product name or number you'd like to know more about, or say *order* to place an order.`,
      `We have a wide range of products at ${biz}. What are you looking for? I can help you find exactly what you need! 🛍️`,
    ],
    PRICE_CHECK: [
      `Sure! Tell me which product you'd like the price for and I'll get that for you right away. 💰`,
      `Happy to help with pricing! Which item would you like to know the cost of?`,
    ],
    PLACE_ORDER: [
      `Great, let's place your order! 🛒 Please tell me:\n1️⃣ Product name\n2️⃣ Quantity\n3️⃣ Delivery address (or pickup)`,
      `I'd love to help you order! Tell me what you need and how many, and we'll get it sorted! 📦`,
    ],
    ORDER_INQUIRY: [
      `Let me check on your order! Could you share your order number or the phone number you used? 🔍`,
      `I'll look that up for you right away. Please share your order number and I'll give you a full update! 📋`,
    ],
    DELIVERY_STATUS: [
      `Let me track that for you! Share your order number and I'll give you the latest update. 🚚`,
      `I'll check the delivery status right away. What's your order number? 📍`,
    ],
    COMPLAINT: [
      `I'm really sorry to hear that! 😔 Your experience matters to us. Let me connect you with our team right away to resolve this. Could you describe the issue in detail?`,
      `I apologize for the inconvenience. Please share the details and we'll make it right immediately! 🙏`,
    ],
    PAYMENT_QUERY: [
      `We accept Cash, UPI (GPay, PhonePe, Paytm), and bank transfers. Is there a specific payment query I can help with? 💳`,
      `Happy to help with payment! What would you like to know? We accept all major payment methods. 💰`,
    ],
    APPOINTMENT_BOOK: [
      `I'd be happy to help you book an appointment! 📅 What service are you looking for and when would you like to come in?`,
      `Let's schedule that for you! Tell me the service and your preferred date/time and we'll confirm quickly.`,
    ],
    FEEDBACK: [
      `Thank you so much for your feedback! 🌟 It means a lot to us. We're always working to improve our service.`,
      `We really appreciate you taking the time to share your experience! ⭐ Your feedback helps us serve you better.`,
    ],
    UNSUBSCRIBE: [
      `Understood! I've noted your preference. You won't receive promotional messages from us. If you ever need help, we're always here! 🙏`,
    ],
    GENERAL_INQUIRY: [
      `Hi ${name}! Thanks for reaching out to ${biz}. 😊 How can I help you today?`,
      `Hello! I'm here to help. What would you like to know about ${biz}?`,
    ],
  };

  const options = responses[intent] || responses.GENERAL_INQUIRY;
  return options[Math.floor(Math.random() * options.length)];
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────
export async function orchestrate(context: AgentContext): Promise<AgentResponse> {
  const intent = classifyIntent(context.message);
  const systemPrompt = await buildBusinessContext(context.businessId);

  // Determine which agent to use
  let reply: string;
  let handoffToHuman = false;
  const suggestedReplies: string[] = [];

  switch (intent) {
    case 'COMPLAINT':
      reply = await generateAIResponse(context, intent, systemPrompt);
      handoffToHuman = true; // Always escalate complaints
      break;

    case 'PLACE_ORDER':
      reply = await generateAIResponse(context, intent, systemPrompt);
      suggestedReplies.push('View Catalog', 'My Previous Orders', 'Help');
      break;

    case 'DELIVERY_STATUS':
      // Try to look up real order
      const recentOrder = await prisma.order.findFirst({
        where: {
          businessId: context.businessId,
          customerId: context.customerId,
        },
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true, status: true, createdAt: true },
      });

      if (recentOrder) {
        const statusMap: Record<string, string> = {
          PENDING: '⏳ Pending confirmation',
          CONFIRMED: '✅ Confirmed',
          PROCESSING: '🔄 Being prepared',
          READY: '📦 Ready for pickup/dispatch',
          SHIPPED: '🚚 Shipped',
          OUT_FOR_DELIVERY: '🛵 Out for delivery',
          DELIVERED: '✅ Delivered',
          CANCELLED: '❌ Cancelled',
        };
        reply = `Order ${recentOrder.orderNumber} status: *${statusMap[recentOrder.status] || recentOrder.status}* 📋\n\nPlaced on: ${new Date(recentOrder.createdAt).toLocaleDateString('en-IN')}\n\nNeed more help? Just ask!`;
      } else {
        reply = await generateAIResponse(context, intent, systemPrompt);
      }
      break;

    case 'CATALOG_BROWSE':
      // Fetch top products
      const products = await prisma.product.findMany({
        where: { businessId: context.businessId, isActive: true },
        select: { name: true, price: true },
        take: 6,
        orderBy: { totalSold: 'desc' },
      });

      if (products.length > 0) {
        const list = products.map((p, i) => `${i + 1}. *${p.name}* — ₹${p.price}`).join('\n');
        reply = `Here are our popular items 🛍️:\n\n${list}\n\nReply with the number or name to order, or ask for more details!`;
      } else {
        reply = await generateAIResponse(context, intent, systemPrompt);
      }
      suggestedReplies.push('Place Order', 'View All Products', 'Prices');
      break;

    case 'GREETING':
      reply = await generateAIResponse(context, intent, systemPrompt);
      suggestedReplies.push('Browse Catalog', 'Place Order', 'Track Order', 'Contact Owner');
      break;

    default:
      reply = await generateAIResponse(context, intent, systemPrompt);
  }

  return {
    reply,
    intent,
    confidence: 0.85,
    handoffToHuman,
    suggestedReplies,
  };
}
