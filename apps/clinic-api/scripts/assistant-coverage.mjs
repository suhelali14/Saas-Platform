// How much of the app can be worked by voice, read from the source.
//
//   node scripts/assistant-coverage.mjs            the table
//   node scripts/assistant-coverage.mjs --check    fails if a route that
//                                                  changes something was
//                                                  added without saying
//                                                  whether the assistant
//                                                  may use it
//   node scripts/assistant-coverage.mjs --accept   records today's gaps
//                                                  as known
//
// ── Why this exists ──────────────────────────────────────────────────
//
// A feature reaches the assistant by telling it (lib/assistant/declare.ts).
// Nothing used to notice a feature that did not: it shipped, and the
// assistant went on saying the app could not do it. This reads every
// route that changes something and asks one question of it:
//
//   does the assistant use it       it declared itself, or one of the
//                                   assistant's own actions calls it
//   or was it left out on purpose   it says `assistant: false`
//
// A route that is neither is a gap. The gaps that exist today are kept
// in test/assistant-coverage.baseline.json, so that the check starts
// honest and only ever tightens: a NEW route that is neither fails it.
//
// It reads source, not a running server, so it needs no database.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "src", "routes");
const assistantDir = join(root, "src", "lib", "assistant");
const baselinePath = join(root, "test", "assistant-coverage.baseline.json");

/** An address with its ids taken out, so two spellings of it compare. */
const shape = (url) => url.replace(/\$\{[^}]+\}/g, ":x").replace(/:[A-Za-z]+/g, ":x").replace(/\?.*$/, "");

// Every route that changes something, and what it says of the assistant.
const routes = [];
for (const file of readdirSync(routesDir).filter((f) => f.endsWith(".ts"))) {
  const source = readFileSync(join(routesDir, file), "utf8");
  const pattern = /app\.(post|put|patch|delete)\(\s*"(\/api\/clinic\/[^"]+)"\s*,\s*(\{)?/g;
  for (const match of source.matchAll(pattern)) {
    const [, method, url, options] = match;
    // The options object, when there is one, is where it tells or opts out.
    const head = options ? source.slice(match.index, match.index + 2500) : "";
    const upTo = head.search(/\}\s*,\s*async\s*\(/);
    const config = upTo > 0 ? head.slice(0, upTo) : "";
    routes.push({
      file,
      method: method.toUpperCase(),
      url,
      told: /assistant:\s*told\(/.test(config),
      optedOut: /assistant:\s*false/.test(config),
    });
  }
}

// Every address one of the assistant's own actions calls.
const called = new Set();
for (const file of readdirSync(assistantDir).filter((f) => f.endsWith(".ts"))) {
  const source = readFileSync(join(assistantDir, file), "utf8");
  for (const match of source.matchAll(/\.call\(\s*"(POST|PUT|PATCH|DELETE)"\s*,\s*[`"]([^`"]+)[`"]/g)) {
    called.add(`${match[1]} ${shape(match[2])}`);
  }
}
// The listening assistant writes a visit's records itself (routes/clinic-scribe.ts).
const public_ = (r) => r.url.includes("/public/") || r.url.startsWith("/api/clinic/auth/") || r.url.startsWith("/api/clinic/assistant/") || r.url.startsWith("/api/clinic/scribe/");

const rows = routes.filter((r) => !public_(r)).map((r) => ({
  ...r,
  key: `${r.method} ${r.url}`,
  state: r.told ? "tells" : called.has(`${r.method} ${shape(r.url)}`) ? "used" : r.optedOut ? "left out" : "gap",
}));

const gaps = rows.filter((r) => r.state === "gap").map((r) => r.key).sort();
const covered = rows.filter((r) => r.state === "tells" || r.state === "used").length;
const mode = process.argv[2];

if (mode === "--accept") {
  writeFileSync(baselinePath, JSON.stringify({ note: "Routes that change something and cannot yet be used by voice. This list should only get shorter. A new route must tell the assistant about itself or say `assistant: false`.", gaps }, null, 2) + "\n");
  console.log(`Recorded ${gaps.length} known gaps in test/assistant-coverage.baseline.json.`);
  process.exit(0);
}

const known = existsSync(baselinePath) ? new Set(JSON.parse(readFileSync(baselinePath, "utf8")).gaps) : new Set();
const fresh = gaps.filter((g) => !known.has(g));
const closed = [...known].filter((g) => !gaps.includes(g));

if (mode === "--check") {
  if (fresh.length > 0) {
    console.error(`\n${fresh.length} route(s) change something and say nothing of the assistant:\n`);
    for (const g of fresh) console.error(`  ${g}`);
    console.error(`\nEach needs one of:\n  config: { assistant: told({ summary, asks, title }) }   so it can be asked for by voice (lib/assistant/declare.ts)\n  config: { assistant: false }                            with a comment saying why not\n`);
    process.exit(1);
  }
  if (closed.length > 0) console.log(`${closed.length} gap(s) have been closed since the baseline. Run with --accept to record it.`);
  console.log(`Assistant coverage: ${covered} of ${rows.length} routes that change something can be used by voice; ${gaps.length} known gaps; no new ones.`);
  process.exit(0);
}

// The table.
const byArea = new Map();
for (const r of rows) {
  const area = r.url.replace("/api/clinic/", "").split("/")[0];
  const row = byArea.get(area) ?? { total: 0, covered: 0, out: 0, gaps: [] };
  row.total += 1;
  if (r.state === "tells" || r.state === "used") row.covered += 1;
  else if (r.state === "left out") row.out += 1;
  else row.gaps.push(`${r.method} ${r.url.replace("/api/clinic", "")}`);
  byArea.set(area, row);
}
console.log(`\nRoutes that change something: ${rows.length}. Usable by voice: ${covered}. Left out on purpose: ${rows.filter((r) => r.state === "left out").length}. Gaps: ${gaps.length}.\n`);
for (const [area, row] of [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${area.padEnd(24)} ${String(row.covered).padStart(2)} of ${String(row.total).padStart(2)} by voice${row.gaps.length ? `   not yet: ${row.gaps.join(", ")}` : ""}`);
}
