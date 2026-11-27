/**
 * The plan the Nayaversse console sets: it takes the env's place at once, a
 * module that is off answers like a path that does not exist, and only the
 * console's signature can set it. No database, no Redis: nothing here
 * reaches either.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://none:none@127.0.0.1:5999/none";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";
process.env.CLINIC_PLAN = "BASIC";

const { applyPlanOverride, currentPlan, enabledModules, isFeatureEnabled, isReadOnly, planDefaults } = await import("../src/config/features.js");
const { privateKeyFrom, publicKeyFrom, signRequest, verifyRequest } = await import("../src/lib/s2s.js");
const { buildApp } = await import("../src/app.js");

test("the console's plan replaces the env's at once, and leaving it brings the env back", () => {
  applyPlanOverride(null);
  assert.equal(currentPlan().tier, "BASIC");
  assert.ok(!isReadOnly());
  const premium = [...planDefaults("PREMIUM")];
  applyPlanOverride({ plan: "PREMIUM", features: premium.join(","), readOnly: false, paidUntil: new Date("2027-11-28") });
  assert.equal(currentPlan().tier, "PREMIUM");
  assert.deepEqual([...enabledModules()].sort(), premium.sort());
  applyPlanOverride({ plan: "PREMIUM", features: premium.join(","), readOnly: true, paidUntil: null });
  assert.ok(isReadOnly(), "the console can pause a clinic");
  applyPlanOverride(null);
  assert.equal(currentPlan().tier, "BASIC");
});

test("a module that is off answers like an unknown path, and opens without a restart", async () => {
  applyPlanOverride({ plan: "BASIC", features: "", readOnly: false, paidUntil: null });
  const app = buildApp();
  await app.ready();
  try {
    const unknown = await app.inject({ method: "GET", url: "/api/clinic/no-such-thing" });
    const off = await app.inject({ method: "GET", url: "/api/clinic/lab-tests" });
    assert.equal(off.statusCode, 404);
    assert.equal(off.statusCode, unknown.statusCode, "nothing to probe");
    assert.ok(!isFeatureEnabled("labs"));
    // The console sets a plan with labs: the same path is there now, asking for a sign-in.
    applyPlanOverride({ plan: "STANDARD", features: "labs", readOnly: false, paidUntil: null });
    const on = await app.inject({ method: "GET", url: "/api/clinic/lab-tests" });
    assert.equal(on.statusCode, 401);
    // A pause stops changes, and still lets the plan be paid for.
    applyPlanOverride({ plan: "STANDARD", features: "labs", readOnly: true, paidUntil: null });
    const write = await app.inject({ method: "POST", url: "/api/clinic/patients", payload: {} });
    assert.equal(write.statusCode, 423);
    const pay = await app.inject({ method: "POST", url: "/api/clinic/plan/subscribe", payload: {} });
    assert.notEqual(pay.statusCode, 423, "the way out of a pause stays open");
    // Only the console's signature sets a plan; without the console set up there is nothing there.
    const unsigned = await app.inject({ method: "PUT", url: "/api/s2s/v1/plan", payload: { plan: "ENTERPRISE" } });
    assert.ok([401, 404].includes(unsigned.statusCode));
    assert.equal(currentPlan().tier, "STANDARD");
  } finally {
    applyPlanOverride(null);
    await app.close();
  }
});

// The same throwaway key and signature the console and Growth check.
test("the clinic signs and checks exactly as the console and Growth do", () => {
  const pub = publicKeyFrom("MCowBQYDK2VwAyEA6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=");
  const sig = "VKBZiiLGlaVfR7yaRp7uJRTeXIXyxlp78rz5iaxF3Ia61OuBmtqJMrWS+9PTMXuOBU0Ip9IxgrKy6uoJAi2GAw==";
  assert.ok(verifyRequest(pub, "POST", "/api/s2s/v1/grants", '{"ref":"charge-1","businessId":"biz-1"}', "1764300000", sig, 1764300000 * 1000));
  const priv = privateKeyFrom("MC4CAQAwBQYDK2VwBCIEIAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH");
  assert.equal(signRequest(priv, "POST", "/api/s2s/v1/grants", '{"ref":"charge-1","businessId":"biz-1"}', 1764300000 * 1000).signature, sig);
});
