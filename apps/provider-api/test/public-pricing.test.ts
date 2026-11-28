/**
 * nayaversse.in reads the console's public prices from the browser. Its
 * addresses may read those and nothing else: the rest of this API keeps its
 * own allowed origins.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.NODE_ENV = "production";
process.env.CORS_ORIGINS = "https://console.example.test";
process.env.SITE_ORIGINS = "https://site.example.test";

const { buildApp } = await import("../src/app.js");

test("the site's address gets no CORS headers from the rest of the API", async () => {
  const app = buildApp();
  try {
    const res = await app.inject({ method: "GET", url: "/api/provider/auth/me", headers: { origin: "https://site.example.test" } });
    assert.notEqual(res.statusCode, 500, "not refused as an unknown origin");
    assert.equal(res.headers["access-control-allow-origin"], undefined);
    assert.equal(res.headers["access-control-allow-credentials"], undefined);
  } finally {
    await app.close();
  }
});

test("the console's own address still gets credentialed CORS", async () => {
  const app = buildApp();
  try {
    const res = await app.inject({ method: "GET", url: "/api/provider/auth/me", headers: { origin: "https://console.example.test" } });
    assert.equal(res.headers["access-control-allow-origin"], "https://console.example.test");
    assert.equal(res.headers["access-control-allow-credentials"], "true");
  } finally {
    await app.close();
  }
});

test("an address on neither list is still refused", async () => {
  const app = buildApp();
  try {
    const res = await app.inject({ method: "GET", url: "/api/provider/auth/me", headers: { origin: "https://elsewhere.example.test" } });
    assert.equal(res.headers["access-control-allow-origin"], undefined);
    assert.equal(res.statusCode, 500);
  } finally {
    await app.close();
  }
});
