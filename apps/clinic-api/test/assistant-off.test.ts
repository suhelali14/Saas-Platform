/**
 * The clinic assistant is held back on every deployment until it is
 * switched on twice over: ASSISTANT_ENABLED=true, and "scribe" in the
 * deal's module list. A plan never brings it, not even the top one.
 *
 * This file sets the environment itself, before anything reads it, so it
 * sees what a live clinic with an old module list naming "scribe" sees.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";
process.env.CLINIC_PLAN = "ENTERPRISE";
process.env.CLINIC_FEATURES = "billing,labs,scribe";
delete process.env.ASSISTANT_ENABLED;

const { resolveModules, planDefaults, isFeatureEnabled, moduleStates } = await import("../src/config/features.js");

test("no plan brings the assistant, not even the top one", () => {
  for (const tier of ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as const) {
    assert.ok(!planDefaults(tier).has("scribe"), `${tier} should not include the assistant`);
    assert.ok(!resolveModules(tier, undefined).has("scribe"), `${tier} with no list should not include it`);
  }
});

test("a list may name it, so a deal can sell it", () => {
  assert.ok(resolveModules("BASIC", "billing,scribe").has("scribe"));
});

test("but with ASSISTANT_ENABLED unset it is off, even when the list names it", () => {
  assert.equal(isFeatureEnabled("scribe"), false);
  assert.equal(moduleStates().scribe, false);
  // and nothing else on the list is touched
  assert.equal(isFeatureEnabled("billing"), true);
  assert.equal(isFeatureEnabled("labs"), true);
});
