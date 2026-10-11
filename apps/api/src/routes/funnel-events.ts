import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/auth.js";
import { recordFunnelEvent } from "../services/funnel-service.js";

// Only RESULT_OPENED is ever posted here today -- INTENT_SUBMITTED and
// RESULTS_SHOWN are recorded server-side inside intent-requests.ts, since
// the server already knows exactly when those happen. COMPARED/BOOKED are
// accepted for forward-compatibility but nothing in the app fires them yet.
const recordFunnelEventSchema = z.object({
  eventType: z.enum(["INTENT_SUBMITTED", "RESULTS_SHOWN", "RESULT_OPENED", "COMPARED", "BOOKED"]),
  intentRequestId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function funnelEventRoutes(app: FastifyInstance) {
  app.post("/api/funnel-events", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = recordFunnelEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    await recordFunnelEvent(userId, parsed.data.eventType, {
      intentRequestId: parsed.data.intentRequestId,
      metadata: parsed.data.metadata,
    });
    return reply.status(201).send({ ok: true });
  });
}
