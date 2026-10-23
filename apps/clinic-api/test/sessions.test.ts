/**
 * Session revocation, against the real module.
 *
 * `__setRedisForTests` has existed since sessions.ts was written, with a
 * comment saying the only caller is the session test. There was no session
 * test. So the security-critical half of authentication -- can access
 * actually be taken away -- had no regression guard at all, and a change to
 * it would be caught only by somebody noticing in production.
 *
 * These exercise the shipped functions through a real ioredis client against
 * a real RESP server, rather than asserting against a hand-written mock. A
 * mock would pass whatever the module does, which is the one thing a test of
 * revocation must not do.
 */

import { strict as assert } from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Redis } from "ioredis";

/*
 * config/env.ts validates the whole environment the moment it is imported,
 * which is right for the app -- a clinic should refuse to boot with half a
 * configuration rather than fail on the first request. It does mean a unit
 * test has to supply one.
 *
 * These are placeholders, not configuration: the Redis client is replaced
 * below with one pointed at a throwaway server, and nothing here opens the
 * database. Set before the import, because an ESM import runs its module
 * immediately.
 */
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";

const {
  __setRedisForTests,
  createSession,
  listSessions,
  newSessionId,
  readSession,
  revokeAllForUser,
  revokeOtherSessions,
  revokeSession,
  revokedReason,
} = await import("../src/lib/sessions.js");
type SessionRecord = Awaited<ReturnType<typeof readSession>> extends infer R
  ? NonNullable<R>
  : never;

const here = dirname(fileURLToPath(import.meta.url));
// A port of its own, so a developer's own Redis on 6379 is never touched.
const PORT = 6399;

let server: ChildProcess;
let client: Redis;

before(async () => {
  server = spawn(process.execPath, [join(here, "..", "scripts", "dev-redis.mjs"), String(PORT)], {
    stdio: "ignore",
  });

  // Wait for the port, rather than racing it. Spawning returns before the
  // child has bound anything, so connecting straight away is ECONNREFUSED
  // and every test below fails in its hook for a reason that has nothing to
  // do with sessions.
  for (let i = 0; i < 60; i += 1) {
    const reachable = await new Promise<boolean>((resolve) => {
      const probe = connect({ host: "127.0.0.1", port: PORT });
      probe.once("connect", () => { probe.destroy(); resolve(true); });
      probe.once("error", () => { probe.destroy(); resolve(false); });
    });
    if (reachable) break;
    if (i === 59) throw new Error(`dev-redis never opened port ${PORT}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  client = new Redis(`redis://127.0.0.1:${PORT}`, { enableOfflineQueue: false, lazyConnect: false });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev-redis never became ready")), 10_000);
    client.once("ready", () => { clearTimeout(timer); resolve(); });
    client.once("error", (e) => { clearTimeout(timer); reject(e); });
  });
  __setRedisForTests(client);
});

after(async () => {
  client?.disconnect();
  server?.kill();
});

const record = (userId: string, agent?: string): SessionRecord => ({
  userId,
  role: "RECEPTIONIST",
  isAdmin: false,
  tokenVersion: 1,
  createdAt: new Date().toISOString(),
  ...(agent ? { userAgent: agent } : {}),
});

const freshUser = () => `u_${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// The baseline: a session exists and can be read back.
// ---------------------------------------------------------------------------

test("a created session reads back, and an unknown one does not", async () => {
  const user = freshUser();
  const sid = newSessionId();
  await createSession(sid, record(user));

  const got = await readSession(sid);
  assert.equal(got?.userId, user);
  assert.equal(await readSession(newSessionId()), null);
});

test("the session id is sized like the credential it is", () => {
  // It is what stands between a verified token and a live session, so it
  // is 32 bytes of randomness rather than a counter.
  const a = newSessionId();
  assert.ok(a.length >= 40, `expected a long id, got ${a.length} chars`);
  assert.notEqual(a, newSessionId());
});

// ---------------------------------------------------------------------------
// One device per login. This is what makes a seat a seat.
// ---------------------------------------------------------------------------

test("signing in elsewhere ends the other sessions and keeps the new one", async () => {
  const user = freshUser();
  const [a, b, c] = [newSessionId(), newSessionId(), newSessionId()];
  await createSession(a, record(user, "Phone"));
  await createSession(b, record(user, "Desk"));
  await createSession(c, record(user, "Laptop"));

  const ended = await revokeOtherSessions(user, c);

  assert.equal(ended, 2);
  assert.equal(await readSession(a), null, "the phone should be signed out");
  assert.equal(await readSession(b), null, "the desk should be signed out");
  assert.ok(await readSession(c), "the device that just signed in must survive");
});

test("the index is left holding only the surviving session", async () => {
  // Without the srem, "sign me out everywhere" later walks ids that no
  // longer exist, and the list of devices shows sessions nobody holds.
  const user = freshUser();
  const [a, b] = [newSessionId(), newSessionId()];
  await createSession(a, record(user));
  await createSession(b, record(user));

  await revokeOtherSessions(user, b);

  const open = await listSessions(user, b);
  assert.deepEqual(open.map((s) => s.sid), [b]);
  assert.equal(open[0]?.current, true);
});

test("with nothing else open it ends nothing and reports nothing", async () => {
  const user = freshUser();
  const only = newSessionId();
  await createSession(only, record(user));

  assert.equal(await revokeOtherSessions(user, only), 0);
  assert.ok(await readSession(only));
});

test("one user's sessions are not touched by another's sign-in", async () => {
  const [one, two] = [freshUser(), freshUser()];
  const theirs = newSessionId();
  const mine = newSessionId();
  await createSession(theirs, record(one));
  await createSession(mine, record(two));

  await revokeOtherSessions(two, newSessionId());

  assert.ok(await readSession(theirs), "a different user must keep their session");
});

// ---------------------------------------------------------------------------
// Why a session ended, which is the difference between an explanation and
// "session expired" to somebody who was working seconds ago.
// ---------------------------------------------------------------------------

test("a session ended by another device says so", async () => {
  const user = freshUser();
  const [old, now] = [newSessionId(), newSessionId()];
  await createSession(old, record(user));
  await createSession(now, record(user));

  await revokeOtherSessions(user, now);

  assert.equal(await revokedReason(old), "another-device");
});

test("a session ended by a permission change says that instead", async () => {
  const user = freshUser();
  const sid = newSessionId();
  await createSession(sid, record(user));

  await revokeAllForUser(user);

  assert.equal(await readSession(sid), null);
  assert.equal(await revokedReason(sid), "permissions-changed");
});

test("the reason outlives the session it describes", async () => {
  // The point of recording it: the session row is gone, and the laptop
  // reopened the next morning still gets told what happened.
  const user = freshUser();
  const [old, now] = [newSessionId(), newSessionId()];
  await createSession(old, record(user));
  await createSession(now, record(user));
  await revokeOtherSessions(user, now);

  assert.equal(await readSession(old), null, "the session must be gone");
  assert.ok(await revokedReason(old), "and the reason must not be");
});

test("a session that merely never existed has no reason", async () => {
  // So an expired or forged token gets the plain message, not a claim
  // that somebody else signed in.
  assert.equal(await revokedReason(newSessionId()), null);
});

test("signing out by hand does not blame another device", async () => {
  const user = freshUser();
  const sid = newSessionId();
  await createSession(sid, record(user));

  await revokeSession(sid, user);

  assert.equal(await readSession(sid), null);
  assert.equal(
    await revokedReason(sid),
    null,
    "a deliberate sign-out needs no explanation, and must not borrow one",
  );
});

// ---------------------------------------------------------------------------
// Deactivating someone, which is the case the session store was built for.
// ---------------------------------------------------------------------------

test("revoking everything leaves the user with nothing open", async () => {
  const user = freshUser();
  const sids = [newSessionId(), newSessionId(), newSessionId()];
  for (const sid of sids) await createSession(sid, record(user));

  assert.equal(await revokeAllForUser(user), 3);
  for (const sid of sids) assert.equal(await readSession(sid), null);
  assert.deepEqual(await listSessions(user), []);
});
