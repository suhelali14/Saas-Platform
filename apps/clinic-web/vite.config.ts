import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Fixed, distinct port -- runs alongside SAAS/frontend (5173), apps/admin
// (5174), apps/api (4000), and clinic-api (4100). Its own app per the plan's
// single-tenant-per-deployment model: one clinic-web + clinic-api pair per
// clinic client, never shared.
export default defineConfig({
  plugins: [react()],
  // Matches the provider console, so a component can be moved between the
  // two without rewriting its imports.
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5176 },
})
