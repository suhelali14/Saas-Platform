import type { FastifyInstance } from "fastify";
import type { UserProfileDTO } from "@intently/shared-types";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users/me/profile", async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });

    const response: UserProfileDTO = {
      categoryAffinity: (profile?.categoryAffinity as Record<string, number> | undefined) ?? {},
      avgBudgetByCategory: (profile?.avgBudgetByCategory as Record<string, number> | undefined) ?? {},
      preferredTiming: (profile?.preferredTiming as Record<string, number> | undefined) ?? {},
      updatedAt: (profile?.updatedAt ?? new Date()).toISOString(),
    };
    return response;
  });
}
