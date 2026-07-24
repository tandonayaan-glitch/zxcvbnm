import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Split vendor code from app code so an app-only change doesn't force
    // visitors to re-download the Firebase SDK (the largest dependency —
    // it was previously bundled into every chunk that imports
    // lib/collections.ts, i.e. every service).
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
            return 'vendor-react'
          }
          return 'vendor'
        },
      },
    },
  },
})
