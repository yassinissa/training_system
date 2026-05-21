import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite's base path. Production (npm run build) serves the React bundle
// through Django + WhiteNoise under /static/, so we need the built HTML
// to reference /static/assets/xxx.js. Dev (npm run dev) keeps base '/'.
const isBuild = process.argv.includes('build')

export default defineConfig({
  plugins: [react()],
  base: isBuild ? '/static/' : '/',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api':   { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
