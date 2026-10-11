import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const EXPIRES_IN = "12h";

export interface ClinicTokenPayload {
  clinicUserId: string;
  role: string;
}

export function signClinicToken(clinicUserId: string, role: string): string {
  return jwt.sign({ sub: clinicUserId, role }, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyClinicToken(token: string): ClinicTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("Invalid token payload");
  }
  return { clinicUserId: payload.sub, role: payload.role };
}
