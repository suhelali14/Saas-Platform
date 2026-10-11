import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const EXPIRES_IN = "12h";

export interface ProviderTokenPayload {
  providerUserId: string;
  role: string;
}

export function signProviderToken(providerUserId: string, role: string): string {
  return jwt.sign({ sub: providerUserId, role }, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyProviderToken(token: string): ProviderTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("Invalid token payload");
  }
  return { providerUserId: payload.sub, role: payload.role };
}
