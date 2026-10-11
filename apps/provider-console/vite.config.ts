import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port 5177: alongside SAAS/frontend (5173), apps/admin (5174),
// clinic-web (5176), clinic-api (4100) and provider-api (4200).
// This is the VENDOR's console, never deployed to a clinic.
export default defineConfig({
  plugins: [react()],
  server: { port: 5177 },
})
