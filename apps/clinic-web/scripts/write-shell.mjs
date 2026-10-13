/**
 * Inlines the build's outputs into the module the SEO functions import.
 *
 * Two things get baked in, for the same underlying reason: a serverless
 * function's world at request time is not the build's world.
 *
 * The app shell, because the function has to return the real HTML with
 * this build's hashed asset filenames. Reading it from disk at request
 * time would depend on the deployment's filesystem layout, which differs
 * between Vercel's runtimes and is the kind of thing that works locally
 * and 500s in production.
 *
 * The directory URL, because a function's environment on Vercel comes
 * from the project's own settings and not from the .env.production this
 * repository's workflow writes for Vite. Depending on process.env alone
 * would mean a manual dashboard step whose absence silently downgrades
 * every page to the generic head -- and silent is the worst kind of
 * broken for something only a crawler sees.
 *
 * Run after `vite build`, from the build script. The module is emitted
 * as JavaScript plus a .d.ts rather than TypeScript -- see
 * scripts/shell-file.mjs for why that ambiguity was worth removing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeShellModule } from './shell-file.mjs';
import { readEnv } from './read-env.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'dist/index.html');

let html;
try {
  html = readFileSync(source, 'utf8');
} catch {
  console.error(`write-shell: ${source} is missing -- run vite build first.`);
  process.exit(1);
}

// Sanity-checked rather than trusted. A shell with no script tag would
// render nothing, and the failure would look like an application bug
// rather than a build one.
if (!/<script[^>]+src=/.test(html)) {
  console.error('write-shell: the built index.html has no script tag. Refusing to inline it.');
  process.exit(1);
}
if (!html.includes('</head>')) {
  console.error('write-shell: the built index.html has no </head> to inject into.');
  process.exit(1);
}

// Read the way Vite reads it, so this agrees with the bundle.
//
// A plain process.env lookup did not: the deploy workflow writes
// .env.production and Vite parses that for its own replacement without
// exporting it, so this script saw nothing, baked an empty directory
// URL in, and every page would have served the generic head with the
// build green and only a warning in a log. See scripts/read-env.mjs.
const provider = readEnv(['VITE_PROVIDER_API_URL', 'PROVIDER_API_URL']);
const providerApi = provider.value;

if (!providerApi) {
  // Fatal, not a warning. The whole point of the SEO functions is the
  // markup in the response, and without a directory to ask they return
  // the generic shell -- which is indistinguishable, from the outside,
  // from the feature not existing. A warning scrolls past; this does
  // not.
  console.error('write-shell: no VITE_PROVIDER_API_URL or PROVIDER_API_URL found.');
  console.error('             Looked in the environment and in .env.production / .env.');
  console.error('             The SEO functions would have no directory to ask, so every page');
  console.error('             would serve the generic head with nothing reporting a problem.');
  console.error('             Set it as a repository VARIABLE -- see docs/WHERE-ENV-GOES.md.');
  process.exit(1);
}

writeShellModule({
  shell: html,
  providerApi,
  why: "The built app shell and the directory URL, from scripts/write-shell.mjs.",
});

const assets = (html.match(/(?:src|href)="\/assets\/[^"]+"/g) ?? []).length;
console.log(`write-shell: inlined dist/index.html (${html.length} bytes, ${assets} asset refs)`);
console.log(`write-shell: directory ${providerApi} (from the ${provider.from})`);
