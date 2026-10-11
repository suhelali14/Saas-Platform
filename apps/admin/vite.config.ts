import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fixed, distinct port -- runs alongside SAAS/frontend (5173) and apps/api
// (4000). Deliberately its own app (not a /admin route inside
// SAAS/frontend) so the admin JS bundle never ships to a business user's
// browser, and this can sit on its own host/access boundary in production.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
})
