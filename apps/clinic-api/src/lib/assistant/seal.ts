/**
 * A confirm card that can only be confirmed as it was shown.
 *
 * When the assistant proposes a change, it shows a card: "Write this
 * prescription for Ramesh Joshi?". What comes back when Confirm is
 * pressed is a request from a browser, and without this it carried only
 * the action and its parameters -- the PATIENT was whoever happened to be
 * on screen at the moment of the click. A doctor who asked for a
 * prescription on one patient, opened the next from the sidebar, and
 * then pressed Confirm on the card still showing would have saved it to
 * the second patient.
 *
 * So the card is sealed. The server signs exactly what it showed --
 * which action, which parameters, which patient and visit, for which
 * person -- and Confirm must return the seal with all of them unchanged.
 * A card confirmed against a different patient, by a different person,
 * or with its parameters altered, does not verify and nothing is done.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";

export interface Sealed {
  action: string;
  params: unknown;
  patientId: string | null;
  appointmentId: string | null;
  userId: string;
}

/** The same JSON whatever order the keys arrived in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function sign(card: Sealed): Buffer {
  return createHmac("sha256", `assistant-card:${env.JWT_SECRET}`).update(canonical(card)).digest();
}

export function seal(card: Sealed): string {
  return sign(card).toString("base64url");
}

export function sealIsValid(card: Sealed, given: string | undefined): boolean {
  if (!given) return false;
  let presented: Buffer;
  try {
    presented = Buffer.from(given, "base64url");
  } catch {
    return false;
  }
  const expected = sign(card);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

/**
 * Marks a request as one this server made of itself.
 *
 * A change the assistant makes goes through the app's own route, called
 * from inside this process. Those calls all appear to come from one
 * address, so the rate limiter would count the whole clinic's assistant
 * as a single hurried visitor and start refusing it. The outer request
 * was already counted; the inner one carries this mark and is not
 * counted again. The mark is random per process and never leaves it, so
 * nothing outside can present it.
 */
export const INTERNAL_CALL_HEADER = "x-clinic-internal-call";
export const INTERNAL_CALL_TOKEN = randomBytes(24).toString("base64url");
