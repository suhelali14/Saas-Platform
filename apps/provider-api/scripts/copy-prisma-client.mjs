/**
 * Copies the generated Prisma client into dist/ after tsc runs.
 *
 * The client is generated to src/generated/prisma-client (a custom output
 * path, because three schemas in this monorepo would otherwise fight over
 * the hoisted @prisma/client). It is JavaScript, not TypeScript, so tsc
 * does not emit it -- and src/lib/prisma.ts imports it by a RELATIVE path,
 * which from dist/lib resolves to dist/generated/prisma-client.
 *
 * Without this step `npm start` fails with ERR_MODULE_NOT_FOUND against a
 * path inside dist/. It went unnoticed because development runs through
 * `tsx`, which resolves from src/ where the client does exist. Only a
 * production start exposes it.
 */
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src", "generated");
const to = join(root, "dist", "generated");

if (!existsSync(from)) {
  console.error(`No generated client at ${from} -- run \`npx prisma generate\` first.`);
  process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log(`copied generated client -> ${to}`);
