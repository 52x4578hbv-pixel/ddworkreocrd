import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Critical for running inside embedded hosts / sub-paths:
  // Vite’s default base makes asset URLs absolute (/assets/...).
  // In some environments that causes 404s and a blank page.
  base: './',
  plugins: [react()],
  preview: {
    // Needed so Azure App Service hostname isn’t blocked with:
    // "Blocked request. This host (...) is not allowed."
    allowedHosts: ['ddworkapi-1778615679.azurewebsites.net'],
  },
})
