import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fixed, distinct port -- runs alongside SAAS/frontend (5173), apps/admin
// (5174), apps/api (4000), and clinic-api (4100). Its own app per the plan's
// single-tenant-per-deployment model: one clinic-web + clinic-api pair per
// clinic client, never shared.
export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
})
