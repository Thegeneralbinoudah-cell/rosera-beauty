import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from './src/config/googleMapsApiKey'
import {
  SUPABASE_ANON_KEY_EMBEDDED,
  SUPABASE_URL_EMBEDDED,
} from './src/config/supabaseEmbedded'

const roseraRoot = path.resolve(__dirname)
const parentRoot = path.resolve(__dirname, '..')

/** VITE_* من المجلّد الأب و rosera — rosera له أولوية (ما عدا المفتاح الذي يُحقَن ثابتاً أدناه) */
function mergeViteEnv(mode: string) {
  const fromParent = loadEnv(mode, parentRoot, 'VITE_')
  const fromRosera = loadEnv(mode, roseraRoot, 'VITE_')
  const raw = { ...fromParent, ...fromRosera }
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
  ) as Record<string, string>
}

/**
 * لا تُفرض قيماً فارغة عبر define — وإلا تُستبدل حقنة Vite الافتراضية من envDir/.env.local
 * VITE_GOOGLE_MAPS_API_KEY يُحقَن دائماً من `googleMapsApiKey.ts` (لا منطق ديناميكي).
 */
function defineSupabaseFromMerged(merged: Record<string, string>) {
  const url = (merged.VITE_SUPABASE_URL || SUPABASE_URL_EMBEDDED).trim()
  const anon = (merged.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_EMBEDDED).trim()
  return {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(anon),
  } as Record<string, string>
}

/** Moyasar + payment mode — دمج المجلّد الأب + rosera؛ الإنتاج بدون متغير يُفترض live */
function definePaymentEnv(merged: Record<string, string>, mode: string) {
  const defaultPaymentMode = mode === 'production' ? 'live' : 'free'
  return {
    'import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY': JSON.stringify(
      (merged.VITE_MOYASAR_PUBLISHABLE_KEY ?? '').trim()
    ),
    'import.meta.env.VITE_PAYMENT_MODE': JSON.stringify(
      (merged.VITE_PAYMENT_MODE ?? defaultPaymentMode).trim()
    ),
  } as Record<string, string>
}

export default defineConfig(({ mode }) => {
  const merged = mergeViteEnv(mode)
  return {
    root: roseraRoot,
    envDir: roseraRoot,
    define: {
      ...definePaymentEnv(merged, mode),
      ...defineSupabaseFromMerged(merged),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(GOOGLE_MAPS_API_KEY_EMBEDDED),
    },
    plugins: [
      react(),
      VitePWA({
        devOptions: { enabled: false },
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        /** خرائط Google فقط — لا MapTiler/OSM؛ NetworkOnly لملفات Google لتفادي كاش قديم أو وميض */
        workbox: {
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                /(^|\.)googleapis\.com$/i.test(url.hostname) ||
                /(^|\.)gstatic\.com$/i.test(url.hostname) ||
                /^khms\d*\.googleapis\.com$/i.test(url.hostname),
              handler: 'NetworkOnly' as const,
            },
          ],
        },
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
            'vendor-map': ['@googlemaps/js-api-loader'],
            'vendor-charts': ['recharts'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
