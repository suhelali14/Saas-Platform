import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireBizAuth } from "../../plugins/auth.js";
import { verifyWebhook, processWebhookEntry, sendWhatsAppMessage, sendWhatsAppTemplate } from "../../lib/whatsapp.js";

// Ported from SAAS/backend/src/modules/whatsapp (unify-platform Phase 3,
// last module) -- Meta WhatsApp Cloud API webhook + outbound send.
// `sendWhatsAppMessage`/`sendWhatsAppTemplate` gracefully no-op (log a
// "[WhatsApp DEMO]" line) when WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID
// aren't configured, same pattern as biz-website's GitHub export --
// not further live-tested against the real Meta API since that needs
// real WhatsApp Business API credentials the user hasn't set up.

const sendSchema = z.object({ to: z.string().min(1), message: z.string().min(1) });
const sendTemplateSchema = z.object({ to: z.string().min(1), templateName: z.string().min(1), parameters: z.array(z.string()).optional() });

export async function bizWhatsappRoutes(app: FastifyInstance) {
  // ── Public Meta webhook (no auth -- Meta calls these directly) ─────────
  app.get("/api/biz/whatsapp/webhook", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const mode = query["hub.mode"] ?? "";
    const token = query["hub.verify_token"] ?? "";
    const challenge = query["hub.challenge"] ?? "";

    const verified = verifyWebhook(mode, token, challenge);
    if (verified) {
      return reply.status(200).send(verified);
    }
    return reply.status(403).send("Forbidden");
  });

  app.post("/api/biz/whatsapp/webhook", async (request, reply) => {
    // Ack immediately -- Meta requires a fast 200 or it retries/backs off
    // the webhook; processing happens after the response is sent.
    reply.status(200).send("EVENT_RECEIVED");

    try {
      const body = request.body as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }> };
      const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      let business = null;

      if (phoneNumberId) {
        const channel = await prisma.channel.findFirst({
          where: { type: "WHATSAPP", config: { path: ["phoneNumberId"], equals: phoneNumberId } },
        });
        if (channel) business = await prisma.business.findUnique({ where: { id: channel.businessId } });
      }

      if (!business) {
        // Fallback to the first active business, matching SAAS's original
        // single-tenant-local-testing behavior -- real multi-tenant
        // routing needs each business's Channel row populated with its
        // own phoneNumberId, which is a WhatsApp Business API onboarding
        // step out of scope here.
        business = await prisma.business.findFirst({ where: { isActive: true } });
      }

      if (business) {
        await processWebhookEntry(business.id, body);
      }
    } catch (err) {
      console.error("[biz-whatsapp] Webhook error:", err);
    }
  });

  // ── Authenticated outbound send ─────────────────────────────────────────
  app.post("/api/biz/whatsapp/send", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = sendSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    await sendWhatsAppMessage(parsed.data.to, parsed.data.message);
    return { message: "Message sent successfully" };
  });

  app.post("/api/biz/whatsapp/send-template", async (request, reply) => {
    const auth = requireBizAuth(request, reply);
    if (!auth) return;

    const parsed = sendTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    await sendWhatsAppTemplate(parsed.data.to, parsed.data.templateName, parsed.data.parameters ?? []);
    return { message: "Template sent successfully" };
  });
}
