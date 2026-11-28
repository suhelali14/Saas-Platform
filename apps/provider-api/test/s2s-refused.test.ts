/**
 * Another server refusing this console's signature is a broken connection
 * between servers. It must never reach the browser as a 401: the console's
 * screens read a 401 as "signed out", clear the session and go to the
 * login page, which is what opening the Growth page did while Growth
 * refused the console's key.
 */

import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";

const { privateKeyFrom, refusedBecause, s2sFetch } = await import("../src/lib/s2s.js");

// The throwaway test key (seed 0x07 x 32), as in subscriptions.test.ts.
const PRIVATE = "MC4CAQAwBQYDK2VwBCIEIAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH";

async function refusing(date: string) {
  const server = createServer((_req, res) => {
    res.writeHead(401, { "Content-Type": "application/json", Date: date });
    res.end('{"error":"Bad signature."}');
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

test("a refused signature comes back as a 502 that names the key, not a 401", async () => {
  const { server, base } = await refusing(new Date().toUTCString());
  try {
    await assert.rejects(
      s2sFetch({ base, path: "/api/s2s/v1/requests", key: privateKeyFrom(PRIVATE), keyId: "console" }),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 502);
        assert.match(err.message, /CONSOLE_PUBLIC_KEY is not this console's public key/);
        return true;
      },
    );
  } finally {
    server.close();
  }
});

test("when the clocks are apart, the refusal says so instead", () => {
  const now = Date.parse("2026-11-28T00:00:00Z");
  assert.match(refusedBecause("growth", "Sat, 28 Nov 2026 00:20:00 GMT", now), /clocks are 20 minutes apart/);
  assert.match(refusedBecause("growth", "Sat, 28 Nov 2026 00:01:00 GMT", now), /CONSOLE_PUBLIC_KEY/);
  assert.match(refusedBecause("growth", null, now), /CONSOLE_PUBLIC_KEY/);
});
