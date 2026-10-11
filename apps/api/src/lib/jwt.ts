import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const EXPIRES_IN = "30d";
const BIZ_EXPIRES_IN = "7d";
const ADMIN_EXPIRES_IN = "12h";

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

// Consumer tokens are exactly {sub}; business tokens carry businessId/role;
// admin tokens (below) carry adminRole. Rejecting a payload that has
// businessId or adminRole here keeps all three token shapes strictly
// separate -- none can be mistaken for another even though all three are
// signed with the same JWT_SECRET (unify-platform Phase 2 established this
// for business tokens; the platform-trust-layer admin token follows the
// same rule).
export function verifySessionToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || typeof payload.sub !== "string" || "businessId" in payload || "adminRole" in payload) {
    throw new Error("Invalid token payload");
  }
  return payload.sub;
}

export interface BusinessTokenPayload {
  businessUserId: string;
  businessId: string;
  role: string;
}

export function signBusinessToken(businessUserId: string, businessId: string, role: string): string {
  return jwt.sign({ sub: businessUserId, businessId, role }, env.JWT_SECRET, { expiresIn: BIZ_EXPIRES_IN });
}

export function verifyBusinessToken(token: string): BusinessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.businessId !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new Error("Invalid business token payload");
  }
  return { businessUserId: payload.sub, businessId: payload.businessId, role: payload.role };
}

export interface AdminTokenPayload {
  adminId: string;
  adminRole: string;
}

export function signAdminToken(adminId: string, adminRole: string): string {
  return jwt.sign({ sub: adminId, adminRole }, env.JWT_SECRET, { expiresIn: ADMIN_EXPIRES_IN });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.adminRole !== "string") {
    throw new Error("Invalid admin token payload");
  }
  return { adminId: payload.sub, adminRole: payload.adminRole };
}
