import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'روزيرا ROSERA',
        short_name: 'روزيرا',
        description: 'اكتشفي أفضل صالونات ومراكز التجميل',
        theme_color: '#8B5CF6',
        background_color: '#1A1A2E',
        display: 'standalone',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion'],
          'vendor-map': ['leaflet', 'react-leaflet'],
          'vendor-charts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
