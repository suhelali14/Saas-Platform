/**
 * Clinic health checks leave the console's database (Neon) asleep: the
 * sweep reads it only every six hours, and writes a row only when a clinic
 * goes down or comes back, or as that six-hourly heartbeat.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";

const { checkAllLive, healthForTest, latestHealth, newerHealth } = await import("../src/lib/health.js");

test("a sweep touches the database only when something changes", async () => {
  const calls: string[] = [];
  const rows: { accountId: string; ok: boolean }[] = [];
  const stand = {
    clinicAccount: { findMany: async () => (calls.push("clinics"), [{ id: "c1", apiDomain: "c1.example" }]) },
    healthCheck: {
      findMany: async () => (calls.push("last"), []),
      create: async ({ data }: { data: { accountId: string; ok: boolean } }) => (calls.push("write"), rows.push(data), data),
      deleteMany: async () => (calls.push("prune"), { count: 0 }),
    },
  };
  healthForTest(stand as never);
  let up = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (!up) throw new Error("connect refused");
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    await checkAllLive(); // first sweep: list read, one heartbeat written
    assert.deepEqual(calls, ["clinics", "last", "write", "prune"]);
    calls.length = 0;
    await checkAllLive(); // nothing changed: no database at all
    await checkAllLive();
    assert.deepEqual(calls, []);
    assert.equal(latestHealth("c1")?.ok, true, "the latest result is held in memory");
    up = false;
    await checkAllLive(); // down: written once
    await checkAllLive(); // still down: not again
    assert.deepEqual(calls, ["write"]);
    assert.deepEqual(rows.map((r) => r.ok), [true, false]);
    // The console shows memory when it is newer than the row.
    const stored = { id: "row", accountId: "c1", ok: true, checkedAt: new Date(0) };
    assert.equal((newerHealth("c1", stored) as { ok: boolean }).ok, false);
    assert.equal(newerHealth("nobody", stored), stored);
  } finally {
    globalThis.fetch = realFetch;
  }
});
