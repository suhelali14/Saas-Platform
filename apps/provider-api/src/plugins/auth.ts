import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { verifyProviderToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyRequest {
    providerUserId: string | null;
    providerUserRole: string | null;
    providerUserName: string | null;
  }
}

// Same caching reasoning as the clinic portal: the activity log records a
// readable name, and resolving it per request would be a round trip on
// every call. A provider team is a handful of people.
const NAME_TTL_MS = 5 * 60 * 1000;
const nameCache = new Map<string, { name: string; expiresAt: number }>();

async function resolveName(id: string): Promise<string | null> {
  const hit = nameCache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.name;
  try {
    const user = await prisma.providerUser.findUnique({ where: { id }, select: { name: true } });
    if (!user) return null;
    nameCache.set(id, { name: user.name, expiresAt: Date.now() + NAME_TTL_MS });
    return user.name;
  } catch {
    return null;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("providerUserId", null);
  app.decorateRequest("providerUserRole", null);
  app.decorateRequest("providerUserName", null);

  app.addHook("onRequest", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const payload = verifyProviderToken(header.slice("Bearer ".length));
      request.providerUserId = payload.providerUserId;
      request.providerUserRole = payload.role;
      request.providerUserName = await resolveName(payload.providerUserId);
    } catch {
      // invalid/expired -- routes reject explicitly
    }
  });
};

export default fp(authPlugin);

export interface ProviderAuth { id: string; name: string; role: string }

export function requireProviderAuth(request: FastifyRequest, reply: FastifyReply): ProviderAuth | null {
  if (!request.providerUserId) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }
  return { id: request.providerUserId, name: request.providerUserName ?? "(unknown)", role: request.providerUserRole! };
}

/** Provisioning and deletion create or orphan billable infrastructure, so
 * they are owner-only even though the console is a small team. */
export function requireOwnerAuth(request: FastifyRequest, reply: FastifyReply): ProviderAuth | null {
  const auth = requireProviderAuth(request, reply);
  if (!auth) return null;
  if (auth.role !== "OWNER") {
    reply.status(403).send({ error: "Only an owner can provision or delete infrastructure." });
    return null;
  }
  return auth;
}
