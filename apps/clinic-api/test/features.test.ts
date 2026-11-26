/**
 * Which modules a deployment has on.
 *
 * The case that matters most is the one with no explicit list: a clinic
 * provisioned before modules were enforced must keep everything it had,
 * whatever its plan says, or a deploy takes a live clinic's pharmacy away
 * in the middle of a day.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

// config/env.ts validates the environment on import; these are placeholders.
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";

const { resolveModules, planDefaults, MODULES, ADD_ONS } = await import("../src/config/features.js");

test("an old BASIC clinic with no explicit list keeps every module it had", () => {
  const on = resolveModules("BASIC", undefined);
  for (const key of ["staff", "billing", "labs", "pharmacy", "analytics", "expenses", "multilingual", "aitranslate"]) {
    assert.ok(on.has(key as never), `${key} should stay on`);
  }
});

test("but it does not get the hospital modules added since", () => {
  const on = resolveModules("BASIC", undefined);
  for (const key of ["departments", "cashcounter", "ipd", "ot", "insurance", "schemes", "radiology", "nursing"]) {
    assert.ok(!on.has(key as never), `${key} should be off`);
  }
});

test("a Hospital plan with no list gets the hospital modules, not the multi-specialty ones", () => {
  const on = resolveModules("PREMIUM", undefined);
  assert.ok(on.has("ipd") && on.has("cashcounter") && on.has("departments"));
  assert.ok(!on.has("schemes") && !on.has("radiology"));
});

test("an explicit list is exactly what is on", () => {
  const on = resolveModules("ENTERPRISE", "billing, labs,cashcounter");
  assert.deepEqual([...on].sort(), ["billing", "cashcounter", "labs"]);
});

test("unknown names in the list are dropped, not fatal", () => {
  const on = resolveModules("BASIC", "billing,teleporter,labs");
  assert.deepEqual([...on].sort(), ["billing", "labs"]);
});

test("an empty list means no modules, not the plan's", () => {
  assert.equal(resolveModules("STANDARD", "").size, 0);
  assert.equal(resolveModules("ENTERPRISE", "  ").size, 0);
});

test("each tier includes everything the tier below it does", () => {
  const tiers = ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as const;
  for (let i = 1; i < tiers.length; i += 1) {
    const lower = planDefaults(tiers[i - 1]!);
    const higher = planDefaults(tiers[i]!);
    for (const k of lower) assert.ok(higher.has(k), `${tiers[i]} is missing ${k}`);
  }
  // The top plan has every module except the add-ons, which no plan brings.
  assert.equal(planDefaults("ENTERPRISE").size, MODULES.length - ADD_ONS.size);
});
