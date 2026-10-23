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
export async function revokeAllForUser(
  userId: string,
  reason: RevokedReason = "permissions-changed",
): Promise<number> {
  const r = redis();
  const sids = await r.smembers(userKey(userId));
  if (sids.length === 0) return 0;
  // Recorded before the delete: after it there is nothing left to key on.
  await markRevoked(sids, reason);
  await r.multi()
    .del(...sids.map(sessionKey))
    .del(userKey(userId))
    .exec();
  return sids.length;
}

/**
 * Why a session is gone, kept after the session itself.
 *
 * A revoked session is a deleted row, so the next request is a bare 401 and
 * the screen says "your session expired" -- which, to someone who was
 * working a moment ago, reads as a bug in the software rather than as
 * something that happened for a reason. They call the clinic's admin, who
 * calls us.
 *
 * So the reason outlives the session. The key is the session id, which is
 * already a credential the holder has, so this leaks nothing to anyone who
 * did not have it; it holds no patient data and no user id. The TTL is
 * longer than a session's so the explanation is still there for a laptop
 * reopened the next morning.
 */
export type RevokedReason = "another-device" | "signed-out-elsewhere" | "permissions-changed";

const REVOKED_TTL_SECONDS = 36 * 60 * 60;
const revokedKey = (sid: string) => `sess:revoked:${sid}`;

async function markRevoked(sids: readonly string[], reason: RevokedReason): Promise<void> {
  if (sids.length === 0) return;
  const r = redis();
  const multi = r.multi();
  for (const sid of sids) multi.set(revokedKey(sid), reason, "EX", REVOKED_TTL_SECONDS);
  await multi.exec();
}

/** Why this session ended, if we recorded it. */
export async function revokedReason(sid: string): Promise<RevokedReason | null> {
  try {
    const raw = await redis().get(revokedKey(sid));
    return raw === "another-device" || raw === "signed-out-elsewhere" || raw === "permissions-changed"
      ? raw
      : null;
  } catch {
    // The reason is a courtesy. Failing to read it must never turn a
    // clean 401 into a 500.
    return null;
  }
}

/**
 * End every session this user holds except the one just created.
 *
 * This is what makes a seat a seat. Without it, one login works on any
 * number of devices at once, so a five-person front desk needs one
 * account -- which undercuts the plan's seat cap and, worse, makes the
 * audit trail useless, because every action anyone takes is attributed to
 * whoever owns the shared password. Under the DPDP Act the log has to say
 * who looked at a record, and "one of the five people who know Priya's
 * password" is not an answer.
 *
 * Newest wins, rather than refusing the new sign-in. Refusing is stronger
 * against sharing, but it locks out anyone who closed a browser without
 * signing out, and the clinic cannot wait twelve hours for a session to
 * expire during a consultation. Two people sharing one login log each
 * other out every few minutes, which is unusable enough to stop it.
 */
export async function revokeOtherSessions(userId: string, keepSid: string): Promise<number> {
  const r = redis();
  const sids = (await r.smembers(userKey(userId))).filter((s) => s !== keepSid);
  if (sids.length === 0) return 0;
  await markRevoked(sids, "another-device");
  await r.multi()
    .del(...sids.map(sessionKey))
    .srem(userKey(userId), ...sids)
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
