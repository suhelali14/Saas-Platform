import { Redis } from "ioredis";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Sessions, in this clinic's own Redis.
 *
 * ── What this fixes ─────────────────────────────────────────────────
 *
 * Authentication was a bare JWT with a twelve-hour expiry and nothing
 * behind it. That meant there was no such thing as logging someone out:
 * deactivating a staff member left their token working, with full access
 * to patient records, until it expired on its own. For software holding
 * regulated health data, "we cannot revoke access, you have to wait" is
 * not an answer.
 *
 * A session now exists as a row in Redis that the token points at. No
 * row, no access -- so revocation is a delete, and it takes effect on the
 * next request rather than in twelve hours.
 *
 * ── One Redis per clinic ────────────────────────────────────────────
 *
 * Not one shared instance. The product's first principle is that a breach
 * of any one thing must not expose every clinic, which is why each has
 * its own database; putting every clinic's live sessions in a single
 * store would undo that for the sake of one container. Each clinic's API
 * can reach only its own Redis, enforced by a per-clinic Docker network
 * rather than by convention -- see deploy/render-compose.sh.
 *
 * ── What happens when Redis is not there ────────────────────────────
 *
 * Reads fail closed: no session lookup, no request. The alternative is
 * serving patient data to a token whose revocation status is unknown,
 * which is precisely the hole this was built to close, and an audit trail
 * that cannot say whether access was still authorised is worth little.
 *
 * Redis runs beside the API in the same compose unit, so it being down
 * while the API is up means a deployment fault rather than a network
 * blip, and the health check reports it.
 */

/** Matches the token's lifetime: a session outliving its token is a row
 *  nothing can reach, and a token outliving its session is a 401. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

let client: Redis | null = null;

/**
 * Swap the client, for tests.
 *
 * The alternative was a test that reimplements this file's logic against
 * a mock and checks its own copy -- which passes whatever the shipped
 * module does. Revocation is the security-critical part of this change,
 * so the test exercises the real functions.
 *
 * Not exported from an index and never called in production: the only
 * caller is the session test.
 */
export function __setRedisForTests(fake: unknown): void {
  client = fake as Redis;
}

export function redis(): Redis {
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    // Fail fast rather than queueing a request behind a dead socket.
    // A clinic waiting ten seconds to find out it cannot log in is worse
    // than being told immediately.
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 2,
    // Without this, every command issued while Redis is down is buffered
    // and replayed on reconnect -- so a login attempted during an outage
    // succeeds minutes later, for somebody who has gone home.
    enableOfflineQueue: false,
    lazyConnect: false,
  });
  // Without a listener, a connection error is an unhandled 'error' event
  // and takes the process down -- turning a Redis hiccup into a clinic
  // outage, which is the opposite of what the retry settings are for.
  client.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("[redis]", err.message);
  });
  return client;
}

export interface SessionRecord {
  userId: string;
  role: string;
  isAdmin: boolean;
  /** Copied at sign-in. A mismatch against the user row means every
   *  session was invalidated since, so this one is stale. */
  tokenVersion: number;
  createdAt: string;
  /** For the "where am I signed in" list. Truncated, never parsed. */
  userAgent?: string;
}

const sessionKey = (sid: string) => `sess:${sid}`;
const userKey = (userId: string) => `user:${userId}:sessions`;

export function newSessionId(): string {
  // 32 bytes of randomness. The session id is the credential once the
  // JWT is verified, so it is sized like one.
  return randomBytes(32).toString("base64url");
}

export async function createSession(sid: string, record: SessionRecord): Promise<void> {
  const r = redis();
  await r
    .multi()
    .set(sessionKey(sid), JSON.stringify(record), "EX", SESSION_TTL_SECONDS)
    // The index is what makes "sign this person out everywhere" possible
    // without scanning the keyspace.
    .sadd(userKey(record.userId), sid)
    .expire(userKey(record.userId), SESSION_TTL_SECONDS)
    .exec();
}

export async function readSession(sid: string): Promise<SessionRecord | null> {
  const raw = await redis().get(sessionKey(sid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch {
    // A row we cannot read is a row we cannot trust.
    return null;
  }
}

/** Slides the expiry on use, so an active shift does not get logged out
 *  mid-consultation at exactly twelve hours. */
export async function touchSession(sid: string, userId: string): Promise<void> {
  const r = redis();
  await r.multi().expire(sessionKey(sid), SESSION_TTL_SECONDS).expire(userKey(userId), SESSION_TTL_SECONDS).exec();
}

export async function revokeSession(sid: string, userId: string): Promise<void> {
  await redis().multi().del(sessionKey(sid)).srem(userKey(userId), sid).exec();
}

/**
 * Every session this user holds, gone.
 *
 * Called when someone is deactivated, has their role or admin rights
 * changed, or changes their password. All four are moments where the
 * access they currently hold should stop being the access they had.
 */
export async function revokeAllForUser(userId: string): Promise<number> {
  const r = redis();
  const sids = await r.smembers(userKey(userId));
  if (sids.length === 0) return 0;
  await r.multi()
    .del(...sids.map(sessionKey))
    .del(userKey(userId))
    .exec();
  return sids.length;
}

export interface SessionSummary {
  sid: string;
  createdAt: string;
  userAgent?: string;
  current: boolean;
}

/** What this user has open, for the "signed in on" list. */
export async function listSessions(userId: string, currentSid?: string): Promise<SessionSummary[]> {
  const r = redis();
  const sids = await r.smembers(userKey(userId));
  if (sids.length === 0) return [];
  const rows = await r.mget(...sids.map(sessionKey));
  const out: SessionSummary[] = [];
  for (let i = 0; i < sids.length; i++) {
    const raw = rows[i];
    if (!raw) continue; // expired out from under the index
    try {
      const rec = JSON.parse(raw) as SessionRecord;
      out.push({
        sid: sids[i]!,
        createdAt: rec.createdAt,
        userAgent: rec.userAgent,
        current: sids[i] === currentSid,
      });
    } catch {
      /* skip an unreadable row rather than failing the whole list */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** For the health endpoint. Reports rather than throws, because the
 *  deploy's health check needs a status, not an exception. */
export async function redisHealthy(): Promise<boolean> {
  try {
    return (await redis().ping()) === "PONG";
  } catch {
    return false;
  }
}
