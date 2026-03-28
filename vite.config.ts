import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('/node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor'
          }
          if (id.includes('/src/ui/components/CardView.tsx')) {
            return 'animated-card-view'
          }
          if (id.includes('/src/ui/seatLayout.ts')) {
            return 'seat-layout-core'
          }
        },
      },
    },
  },
})
