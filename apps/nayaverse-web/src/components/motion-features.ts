/**
 * The DOM animation feature set, alone in its own module.
 *
 * This file exists so the bundler can split it out. `LazyMotion`'s own
 * documented form -- `() => import('motion/react').then(m => m.domAnimation)`
 * -- resolves to the module that `m` and `LazyMotion` are already statically
 * imported from, so Rollup keeps it in the main chunk and the "lazy" load is
 * lazy in name only. Measured: it saved 14KB of the 44, and emitted no second
 * chunk at all.
 *
 * Re-exported from here, nothing else imported, the features land in a chunk
 * of their own that is fetched after the page is interactive.
 */
export { domAnimation as default } from 'motion/react';
