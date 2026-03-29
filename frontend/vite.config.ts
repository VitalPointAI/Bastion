/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      usePolling: true, // Needed for Docker volume mounts
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'leaflet-draw'],
  },
  resolve: {
    alias: [
      {
        // Only match bare 'leaflet-draw' import (not 'leaflet-draw/dist/...' paths).
        // react-leaflet-draw does `import Draw from 'leaflet-draw'` which
        // fails in Rolldown (no default export). Redirect to an ESM shim.
        find: /^leaflet-draw$/,
        replacement: '/src/shims/leaflet-draw.ts',
      },
    ],
  },
})
