import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api':     { target: 'http://localhost:9003', changeOrigin: true },
      '/uploads': { target: 'http://localhost:9003', changeOrigin: true },
      '/webhook': { target: 'http://localhost:9003', changeOrigin: true },
      '/health':  { target: 'http://localhost:9003', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@': '/src' },
  },
})
