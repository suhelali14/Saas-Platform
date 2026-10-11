import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { verifySessionToken, verifyBusinessToken, verifyAdminToken } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
    businessUserId: string | null;
    businessId: string | null;
    businessRole: string | null;
    adminId: string | null;
    adminRole: string | null;
  }
}

/**
 * Populates request.userId (consumer), request.businessUserId/businessId/
 * businessRole (BusinessOS), or request.adminId/adminRole (platform admin)
 * from a Bearer JWT if present and valid -- whichever shape the token
 * actually is (see lib/jwt.ts). A missing/invalid token is not itself a
 * rejection -- routes that require auth call requireAuth()/requireBizAuth()/
 * requireAdminAuth() explicitly.
 */
const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("userId", null);
  app.decorateRequest("businessUserId", null);
  app.decorateRequest("businessId", null);
  app.decorateRequest("businessRole", null);
  app.decorateRequest("adminId", null);
  app.decorateRequest("adminRole", null);

  app.addHook("onRequest", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length);

    try {
      const admin = verifyAdminToken(token);
      request.adminId = admin.adminId;
      request.adminRole = admin.adminRole;
      return;
    } catch {
      // Not an admin-shaped token -- fall through and try business.
    }

    try {
      const biz = verifyBusinessToken(token);
      request.businessUserId = biz.businessUserId;
      request.businessId = biz.businessId;
      request.businessRole = biz.role;
      return;
    } catch {
      // Not a business-shaped token -- fall through and try consumer.
    }

    try {
      request.userId = verifySessionToken(token);
    } catch {
      // invalid/expired -- leave everything null
    }
  });
};

export default fp(authPlugin);

export function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.userId) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }
  return request.userId;
}

export interface BizAuthContext {
  businessUserId: string;
  businessId: string;
  role: string;
}

export function requireBizAuth(request: FastifyRequest, reply: FastifyReply): BizAuthContext | null {
  if (!request.businessUserId || !request.businessId) {
    reply.status(401).send({ error: "Business authentication required" });
    return null;
  }
  return {
    businessUserId: request.businessUserId,
    businessId: request.businessId,
    role: request.businessRole!,
  };
}

export interface AdminAuthContext {
  adminId: string;
  role: string;
}

export function requireAdminAuth(request: FastifyRequest, reply: FastifyReply): AdminAuthContext | null {
  if (!request.adminId) {
    reply.status(401).send({ error: "Admin authentication required" });
    return null;
  }
  return { adminId: request.adminId, role: request.adminRole! };
}
