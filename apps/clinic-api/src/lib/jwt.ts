import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const EXPIRES_IN = "12h";

export interface ClinicTokenPayload {
  clinicUserId: string;
  role: string;
  /**
   * The session this token stands for.
   *
   * The token on its own proves only that we signed it. The session id is
   * what makes it revocable: no row in Redis, no access. Before this, a
   * deactivated staff member kept full patient access until their token
   * expired, because nothing could be cancelled.
   */
  sid: string;
}

export function signClinicToken(clinicUserId: string, role: string, sid: string): string {
  return jwt.sign({ sub: clinicUserId, role, sid }, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyClinicToken(token: string): ClinicTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.sid !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return { clinicUserId: payload.sub, role: payload.role, sid: payload.sid };
}
