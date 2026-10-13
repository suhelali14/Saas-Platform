/**
 * Reads a VITE_ variable the way Vite itself would.
 *
 * ── Why this exists ──────────────────────────────────────────────────
 *
 * The deploy workflow writes .env.production and then runs
 * `vercel build`, because Vercel re-runs the framework build in its own
 * environment, which does not carry the variables the workflow set. Vite
 * reads that file natively, so the bundle comes out correct.
 *
 * A sibling script in the same build does NOT. `.env.production` is not
 * loaded into process.env -- Vite parses it for its own compile-time
 * replacement and nothing else. So write-shell.mjs, running right after
 * `vite build`, saw an empty directory URL and baked an empty string
 * into the SEO functions.
 *
 * The effect was the worst kind: the bundle was right, the build was
 * green, a warning scrolled past in a log, and every page served the
 * generic head instead of the clinic's. The feature would have appeared
 * to do nothing with no error anywhere.
 *
 * Verified rather than assumed: a build with the variable only in
 * .env.production put it in the bundle and left PROVIDER_API as "".
 *
 * Precedence matches Vite's for a production build: a real environment
 * variable wins, then .env.production, then .env.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/**
 * A minimal dotenv parse: `KEY=value`, `#` comments, optional quotes.
 *
 * Deliberately small rather than a dependency. The only values this
 * needs to read are URLs and hostnames that the workflow itself writes
 * one per line, and a parser with more opinions than that would be more
 * ways to disagree with Vite.
 */
function parse(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Quotes are stripped, because `docker --env-file` keeps them and
    // shell sourcing does not -- a difference that has already cost
    // this project one outage, so the two are not left to differ again.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let fileValues = null;

function loadFiles() {
  if (fileValues) return fileValues;
  fileValues = {};
  // Later files do NOT override earlier ones, so .env.production wins
  // over .env, as it does in Vite.
  for (const name of ['.env.production', '.env']) {
    const path = resolve(ROOT, name);
    if (!existsSync(path)) continue;
    const parsed = parse(readFileSync(path, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in fileValues)) fileValues[k] = v;
    }
  }
  return fileValues;
}

/**
 * @param {string[]} names Tried in order; the first with a value wins.
 * @returns {{ value: string, from: string }}
 */
export function readEnv(names) {
  for (const name of names) {
    const fromProcess = (process.env[name] ?? '').trim();
    if (fromProcess) return { value: fromProcess, from: `environment (${name})` };
  }
  const files = loadFiles();
  for (const name of names) {
    const fromFile = (files[name] ?? '').trim();
    if (fromFile) return { value: fromFile, from: `.env file (${name})` };
  }
  return { value: '', from: 'nowhere' };
}
