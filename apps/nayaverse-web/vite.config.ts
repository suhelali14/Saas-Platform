import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

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
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5178 },
  build: {
    // Every byte here is in front of a stranger deciding whether to read on.
    assetsInlineLimit: 2048,
  },
})
