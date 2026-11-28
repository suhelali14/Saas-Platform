import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";

/**
 * Server-to-server calls between this console and each product's server
 * (Growth now, clinics next). Every request is signed with the sender's
 * Ed25519 private key, which lives only in the sender's environment; the
 * receiver checks it with the sender's public key. So the console stores no
 * product secret, and a stolen public key signs nothing.
 *
 * Headers:
 *   X-NV-Key        who signed: "console", "growth", ...
 *   X-NV-Time       unix seconds; refused if more than 5 minutes off
 *   X-NV-Signature  base64 Ed25519 signature over
 *                   METHOD \n PATH?QUERY \n TIME \n sha256-hex(body)
 *
 * The same scheme is in Growth (backend/internal/s2s); both test the same
 * vector, so neither can drift.
 */

export const MAX_SKEW_SECONDS = 300;

export function canonical(method: string, pathWithQuery: string, time: string, body: string): string {
  const digest = createHash("sha256").update(body, "utf8").digest("hex");
  return `${method.toUpperCase()}\n${pathWithQuery}\n${time}\n${digest}`;
}

/** A private key from base64 PKCS#8 DER (what scripts/s2s-keygen.mjs prints). */
export function privateKeyFrom(b64: string): KeyObject {
  return createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
}

/** A public key from base64 SPKI DER. */
export function publicKeyFrom(b64: string): KeyObject {
  return createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
}

export function signRequest(key: KeyObject, method: string, pathWithQuery: string, body: string, now = Date.now()) {
  const time = String(Math.floor(now / 1000));
  const signature = sign(null, Buffer.from(canonical(method, pathWithQuery, time, body), "utf8"), key).toString("base64");
  return { time, signature };
}

/** Whether a request was signed by the holder of key, recently. */
export function verifyRequest(key: KeyObject, method: string, pathWithQuery: string, body: string, time: string | undefined, signature: string | undefined, now = Date.now()): boolean {
  if (!time || !signature || !/^\d{1,12}$/.test(time)) return false;
  if (Math.abs(now / 1000 - Number(time)) > MAX_SKEW_SECONDS) return false;
  try {
    return verify(null, Buffer.from(canonical(method, pathWithQuery, time, body), "utf8"), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/**
 * A signed call to a product's server. Returns the parsed JSON, or throws
 * with the product's own error message.
 */
export async function s2sFetch<T = unknown>(opts: { base: string; path: string; method?: string; body?: unknown; key: KeyObject; keyId: string; timeoutMs?: number }): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const url = new URL(opts.base.replace(/\/$/, "") + opts.path);
  const body = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const { time, signature } = signRequest(opts.key, method, url.pathname + url.search, body);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "X-NV-Key": opts.keyId, "X-NV-Time": time, "X-NV-Signature": signature },
    body: method === "GET" ? undefined : body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    // The other server refusing this console's signature is a broken
    // connection between servers, not the person's login: it must never
    // reach the browser as a 401, which the console screens read as
    // "signed out" (they clear the session and go to the login page).
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error(refusedBecause(url.host, res.headers.get("date"))), { status: 502, refused: true });
    }
    const msg = (data as { error?: string } | null)?.error ?? `${res.status} from ${url.host}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data as T;
}

/** Why another server refused a signed call, as far as this side can tell:
 *  the clocks (from its Date header), or else the key. */
export function refusedBecause(host: string, dateHeader: string | null, now = Date.now()): string {
  const theirs = dateHeader ? Date.parse(dateHeader) : NaN;
  if (Number.isFinite(theirs) && Math.abs(now - theirs) > MAX_SKEW_SECONDS * 1000) {
    const minutes = Math.round(Math.abs(now - theirs) / 60_000);
    return `${host} refused this console's signature: the two servers' clocks are ${minutes} minutes apart. Set both to the right time (NTP).`;
  }
  return `${host} refused this console's signature: its CONSOLE_PUBLIC_KEY is not this console's public key. Copy this console's public key into it and restart it.`;
}
