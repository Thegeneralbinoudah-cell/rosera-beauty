import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from './src/config/googleMapsApiKey'
import {
  SUPABASE_ANON_KEY_EMBEDDED,
  SUPABASE_URL_EMBEDDED,
} from './src/config/supabaseEmbedded'

const analyze = process.env.ANALYZE === 'true'

function manualVendorChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('@elevenlabs')) return 'vendor-elevenlabs'
  if (id.includes('@googlemaps')) return 'vendor-googlemaps'
  if (id.includes('recharts')) return 'vendor-recharts'
  if (id.includes('@stripe')) return 'vendor-stripe'
  if (id.includes('framer-motion')) return 'vendor-motion'
  if (id.includes('@supabase')) return 'vendor-supabase'
  if (id.includes('@tanstack/react-query')) return 'vendor-query'
  if (id.includes('lucide-react')) return 'vendor-icons'
  if (id.includes('node_modules/scheduler')) return 'vendor-react'
  if (id.includes('node_modules/react-dom')) return 'vendor-react'
  /** يجب قبل `node_modules/react/` لأن react-router يبدأ بـ react- */
  if (id.includes('node_modules/react-router')) return 'vendor-router'
  if (id.includes('node_modules/react/')) return 'vendor-react'
  if (id.includes('@radix-ui')) return 'vendor-radix'
  if (id.includes('zod')) return 'vendor-zod'
  if (id.includes('date-fns')) return 'vendor-date-fns'
  /** باقي الحزم — دون دلو «other» لتفادي دوران vendor-other ↔ vendor-react */
  return undefined
}

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

/** صوت روزي — نفس منطق Supabase: دمج المجلّد الأعلى + rosera حتى تعمل المفاتيح من أي `.env.local` */
function defineElevenLabsFromMerged(merged: Record<string, string>) {
  return {
    'import.meta.env.VITE_ELEVENLABS_API_KEY': JSON.stringify((merged.VITE_ELEVENLABS_API_KEY ?? '').trim()),
    'import.meta.env.VITE_ELEVENLABS_VOICE_ID': JSON.stringify((merged.VITE_ELEVENLABS_VOICE_ID ?? '').trim()),
  } as Record<string, string>
}

export default defineConfig(({ mode }) => {
  const merged = mergeViteEnv(mode)
  const supabaseUrl = (merged.VITE_SUPABASE_URL ?? '').trim()
  const supabaseAnon = (merged.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (mode === 'development') {
    if (!supabaseUrl || !supabaseAnon) {
      console.error(
        '[Vite][Supabase] ENV missing: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY not found in rosera/.env or parent .env.local'
      )
    } else if (/^your_anon_key$/i.test(supabaseAnon) || supabaseAnon.length < 20) {
      console.error(
        '[Vite][Supabase] VITE_SUPABASE_ANON_KEY is placeholder or too short — use the full anon key from the Supabase dashboard'
      )
    } else {
      console.info('[Vite][Supabase] env loaded:', supabaseUrl.replace(/\/$/, ''))
    }
  }
  return {
    root: roseraRoot,
    envDir: roseraRoot,
    define: {
      ...definePaymentEnv(merged, mode),
      ...defineSupabaseFromMerged(merged),
      ...defineElevenLabsFromMerged(merged),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(GOOGLE_MAPS_API_KEY_EMBEDDED),
    },
    plugins: [
      react(),
      ...(analyze
        ? [
            visualizer({
              /** خارج `dist/` حتى لا يُدخل تقرير PWA precache (ملف كبير) */
              filename: path.resolve(roseraRoot, 'bundle-stats.html'),
              gzipSize: true,
              brotliSize: true,
              template: 'treemap',
              open: false,
            }),
          ]
        : []),
      VitePWA({
        devOptions: { enabled: false },
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'pwa-192.png', 'pwa-512.png'],
        /** خرائط Google فقط — لا MapTiler/OSM؛ NetworkOnly لملفات Google لتفادي كاش قديم أو وميض */
        workbox: {
          /** لا تُسجَّل في precache — تُحمَّل عند الطلب (TTS / لوحات إدارية) */
          globIgnores: ['**/vendor-elevenlabs*.js', '**/vendor-recharts*.js'],
          /** حزم JS/CSS — سقف معقول؛ الحزم الضخمة مُستثناة أعلاه */
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
          name: 'Rosy',
          short_name: 'Rosy',
          description: 'اكتشفي واحجزي أفضل صالونات ومراكز التجميل',
          theme_color: '#F9F4F2',
          background_color: '#F9F4F2',
          display: 'standalone',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    build: {
      /** vendor-elevenlabs ~3.3MB يُحمَّل فقط عند TTS (dynamic import داخل voice.ts) */
      chunkSizeWarningLimit: 3600,
      /** إزالة console/debugger من حزمة الإنتاج — أداء أقل ضوضاء وأمان */
      esbuild: mode === 'production' ? { drop: ['console', 'debugger'] as const } : undefined,
      /** متصفحات حديثة — بدون بوليفيل modulepreload (~1.5KB) */
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks: manualVendorChunks,
        },
      },
    },
  }
})
