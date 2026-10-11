import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireProviderAuth } from "../plugins/auth.js";
import { checkAllLive } from "../lib/health.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "provider-api", timestamp: new Date().toISOString() }));

  /** Ping every live clinic now, rather than waiting for the next sweep. */
  app.post("/api/provider/health/check-now", async (request, reply) => {
    const auth = requireProviderAuth(request, reply);
    if (!auth) return;
    const checked = await checkAllLive();
    const latest = await prisma.healthCheck.findMany({ orderBy: { checkedAt: "desc" }, take: checked });
    return { checked, latest };
  });
}
