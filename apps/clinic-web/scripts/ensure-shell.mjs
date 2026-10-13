/**
 * Writes a placeholder api/_shell.ts when there is not one already.
 *
 * The real file is generated from the build output, and `tsc -b` runs
 * before the build has produced it -- so without this, a clean checkout
 * and CI both fail to compile on a missing module.
 *
 * It is deliberately NOT committed. A committed copy would be
 * overwritten by every build, leaving the working tree permanently
 * dirty and making it easy to commit one build's shell by accident.
 *
 * The placeholder's values are useless on purpose: an empty shell and
 * no directory make the SEO functions serve nothing rather than
 * something wrong, and a real build replaces both.
 */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const target = resolve(import.meta.dirname, '../api/_shell.ts');
if (existsSync(target)) process.exit(0);

mkdirSync(dirname(target), { recursive: true });
writeFileSync(
  target,
  [
    '/**',
    ' * PLACEHOLDER written by scripts/ensure-shell.mjs.',
    ' *',
    ' * Replaced by the real values during `npm run build`. Present only',
    ' * so a clean checkout typechecks before the build has run.',
    ' */',
    "export const SHELL = '';",
    "export const PROVIDER_API = '';",
    '',
  ].join('\n'),
  'utf8',
);
console.log('ensure-shell: wrote a placeholder api/_shell.ts');
