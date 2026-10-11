import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// Public, aggregate, non-sensitive totals -- no per-user or per-business
// data. Feeds the Business Dashboard home page (docs/07-roadmap-phases.md
// Phase 2's business-recruitment pitch: "we have N people/week asking for
// exactly what you sell", docs/08-business-model-gtm.md) with real numbers
// instead of the "—" placeholders that were there before matching/revenue
// existed.
export async function statsRoutes(app: FastifyInstance) {
  app.get("/api/stats", async () => {
    const [totalBusinesses, totalIntentRequests, matchedIntentRequests, totalMatches] = await Promise.all([
      prisma.business.count(),
      prisma.intentRequest.count(),
      prisma.intentRequest.count({ where: { status: "MATCHED" } }),
      prisma.match.count(),
    ]);

    return { totalBusinesses, totalIntentRequests, matchedIntentRequests, totalMatches };
  });
}
