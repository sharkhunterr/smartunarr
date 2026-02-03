import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 4173,
    host: '0.0.0.0',  // Allow access from local network
    proxy: {
      '/api': {
        target: 'http://localhost:4273',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:4273',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
