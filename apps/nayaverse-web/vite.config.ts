import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { lampKeyframes } from './src/components/yard.ts'

/**
 * The route model's lamp run, as a stylesheet in the CSS bundle.
 *
 * The keyframes are computed from the track's geometry, so they cannot be
 * hand-written without drifting from it. They also cannot go inline in the
 * page: the prerender refuses any "N%" in the HTML (there is no measured
 * figure to cite), and a keyframe stop is exactly that shape. So the
 * geometry module writes them here, at build time, into the cached CSS.
 */
function yardKeyframes(): Plugin {
  const id = 'virtual:yard-lamp.css'
  return {
    name: 'nayaverse:yard-keyframes',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (resolved) => (resolved === `\0${id}` ? lampKeyframes('yard-lamp') : undefined),
  }
}

// Nayaverse's own site. Deliberately a separate app from clinic-web:
//
//  - A clinic's front desk loads clinic-web on a phone. It must not also
//    download this company's pricing page.
//  - This page is read by strangers and has to be crawlable and fast, so it
//    is prerendered to static HTML. clinic-web resolves a clinic from the
//    hostname at runtime and cannot be.
//  - A copy fix here should not redeploy every clinic's portal.
//
// Port 5178: clinic-web is 5176, provider-console 5177.
export default defineConfig({
  plugins: [react(), yardKeyframes()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5178 },
  build: {
    // Every byte here is in front of a stranger deciding whether to read on.
    assetsInlineLimit: 2048,
  },
})
