/**
 * The one-click behaviour: when PROVIDER_INLINE_PROVISION=1 the
 * provision step marks a clinic as live in the same request rather than
 * writing a job file for a runner that may not be there to pick it up.
 *
 * The env is validated at import time, so each test runs its own child
 * process with the env it needs and reads the answer back.
 */
import { strict as assert } from "node:assert";
import { test, after } from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
// Written at the project root so its relative import of `./src/lib/...`
// resolves. A probe in test/ would look for test/src.
const probe = path.join(root, ".probe-inline.mjs");

function run(envFlag: string | undefined): { stdout: string; stderr: string; code: number } {
  const bodyLines = [
    "import { shouldProvisionInline, inlineProvisioningEnabled } from './src/lib/inline-provision.js';",
    "console.log(JSON.stringify({ inline: shouldProvisionInline(), enabled: inlineProvisioningEnabled() }));",
  ];
  // Written per test with the env baked in, so the one-time env validator
  // in src/config/env.ts reads this process's state.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/unused",
    JWT_SECRET: "test-secret-not-used-for-anything-real-0000",
    REDIS_URL: "redis://127.0.0.1:6399",
  };
  if (envFlag === undefined) delete env.PROVIDER_INLINE_PROVISION;
  else env.PROVIDER_INLINE_PROVISION = envFlag;

  writeFileSync(probe, bodyLines.join("\n"));
  const r = spawnSync(process.execPath, ["--import", "tsx", probe], {
    cwd: root, encoding: "utf8", env,
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 0 };
}

after(() => { try { unlinkSync(probe); } catch { /* ignore */ } });

test("by default the queue path stays the default", () => {
  const r = run(undefined);
  assert.equal(r.code, 0, `exit ${r.code}: ${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { inline: false, enabled: false });
});

test("explicit 0 keeps the queue path", () => {
  const r = run("0");
  assert.equal(r.code, 0, `exit ${r.code}: ${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { inline: false, enabled: false });
});

test("PROVIDER_INLINE_PROVISION=1 turns the inline path on", () => {
  const r = run("1");
  assert.equal(r.code, 0, `exit ${r.code}: ${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { inline: true, enabled: true });
});

test("a stray value is refused: a 'yes' or 'true' is not a boolean here", () => {
  const r = run("yes");
  assert.notEqual(r.code, 0, "expected failure");
  assert.match(r.stderr, /PROVIDER_INLINE_PROVISION/);
});
