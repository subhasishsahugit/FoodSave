import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages project sites live under /<repo>/, so the deploy workflow
  // sets VITE_BASE_PATH. Local dev and same-origin builds stay at "/".
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  build: {
    // Flask serves the compiled bundle from web/dist
    outDir: '../web/dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // During `npm run dev` the API still comes from Flask on :5000
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
})