/**
 * Writes the generated shell module, as real JavaScript plus its types.
 *
 * ── Why .js and not .ts ──────────────────────────────────────────────
 *
 * The functions import `./_shell.js`. When the file on disk was
 * `_shell.ts`, that resolved only because TypeScript and esbuild both
 * understand a `.js` specifier to mean the `.ts` beside it. Vercel's
 * function builder is esbuild-based so it very probably also would --
 * and "very probably" is not a basis for something that can only be
 * tested by deploying, after three deployment failures that each passed
 * locally.
 *
 * Emitting actual JavaScript plus a `.d.ts` removes the question: every
 * resolver finds `_shell.js` literally, and tsc gets its types from the
 * declaration beside it.
 *
 * Shared by ensure-shell.mjs (the placeholder, at install time) and
 * write-shell.mjs (the real values, after the build), so the two cannot
 * disagree about the module's shape.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const API_DIR = resolve(import.meta.dirname, '../api');

/**
 * @param {{ shell: string, providerApi: string, why: string }} opts
 */
export function writeShellModule({ shell, providerApi, why }) {
  mkdirSync(API_DIR, { recursive: true });

  const js = resolve(API_DIR, '_shell.js');
  const dts = resolve(API_DIR, '_shell.d.ts');

  writeFileSync(
    js,
    [
      '/**',
      ' * GENERATED -- do not edit.',
      ` * ${why}`,
      ' */',
      `export const SHELL = ${JSON.stringify(shell)};`,
      `export const PROVIDER_API = ${JSON.stringify(providerApi)};`,
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    dts,
    [
      '/**',
      ' * GENERATED -- do not edit. Types for _shell.js.',
      ' *',
      " * The built app shell, and the directory URL the SEO functions ask",
      ' * for a clinic by hostname.',
      ' */',
      'export declare const SHELL: string;',
      'export declare const PROVIDER_API: string;',
      '',
    ].join('\n'),
    'utf8',
  );

  return { js, dts };
}

export { API_DIR };
