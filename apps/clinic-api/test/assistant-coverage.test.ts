import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A route that changes something must say whether the assistant may use
 * it. Reads the source (scripts/assistant-coverage.mjs), so this needs
 * no database and runs with the other tests.
 */
test("no new route changes something without telling the assistant or opting out", () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "assistant-coverage.mjs");
  const run = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
