import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * قراءة صريحة من import.meta.env (Vite يحقن VITE_* فقط في العميل).
 * لا تستخدم process.env هنا — لن يعمل في المتصفح.
 */
function readViteEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const raw = import.meta.env[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * القيم من `.env` / `.env.local` داخل `rosera/` (انظر vite.config دمج المجلد الأعلى).
 * المفتاح: JWT كامل في سطر واحد من Supabase → Settings → API.
 */
const url = readViteEnv('VITE_SUPABASE_URL')
const key = readViteEnv('VITE_SUPABASE_ANON_KEY')

function parseJwtPayloadRef(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const payload = JSON.parse(atob(b64 + pad)) as { ref?: string }
    return typeof payload.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

/** يُستخدم للتحقق قبل الاستدعاءات الحرجة */
export const isSupabaseConfigured = url.length > 0 && key.length > 0

function maskUrlForLog(u: string) {
  try {
    const x = new URL(u)
    return `${x.protocol}//${x.host}`
  } catch {
    return '(invalid URL)'
  }
}

function maskSecretForLog(s: string, head = 10, tail = 4) {
  if (!s) return '(empty)'
  if (s.length <= head + tail) return '***'
  return `${s.slice(0, head)}…${s.slice(-tail)} [len=${s.length}]`
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as Window & { __roseraSupabaseEnvLogged?: boolean }
  if (!w.__roseraSupabaseEnvLogged) {
    w.__roseraSupabaseEnvLogged = true
    console.info('[Rosera][env] Supabase (masked)', {
      mode: import.meta.env.MODE,
      VITE_SUPABASE_URL: url ? maskUrlForLog(url) : '(empty)',
      VITE_SUPABASE_ANON_KEY: key ? maskSecretForLog(key) : '(empty)',
    })
    if (url && key) {
      try {
        const hostname = new URL(url).hostname
        if (!/\.supabase\.co$/i.test(hostname)) {
          /* نطاق مخصص — لا نستنتج ref من الـ host */
        } else {
          const hostRef = hostname.replace(/\.supabase\.co$/i, '')
          const keyRef = parseJwtPayloadRef(key)
          if (keyRef && hostRef && keyRef !== hostRef) {
            console.error(
              '[Rosera] VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY من مشروعين مختلفين — دوال الحافة والجلسات ستفشل. وحّدي القيمتين من لوحة نفس المشروع (Settings → API).',
              { urlHost: hostRef, anonJwtRef: keyRef }
            )
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
}

if (import.meta.env.DEV && (!url?.trim() || !key?.trim())) {
  console.warn('[Rosera] عرّفي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env أو .env.local (أو ROSERA/.env.local — يُدمج مع rosera/)')
} else if (import.meta.env.DEV && key && key.length < 100) {
  console.warn('[Rosera] يبدو أن VITE_SUPABASE_ANON_KEY غير كامل — تأكدي أنه JWT كامل في سطر واحد')
}

/** عميل Supabase واحد للتطبيق — يُصدَّر للاستيراد من أي مكوّن */
export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** صف أعمال مع ارتباط اختياري بالمدينة (للبحث) */
export type Business = {
  id: string
  name_ar: string
  name_en?: string
  description_ar?: string
  category: string
  category_label?: string | null
  city: string
  region?: string | null
  city_id?: string | null
  address_ar?: string
  latitude?: number
  longitude?: number
  phone?: string
  whatsapp?: string
  cover_image?: string
  /** إن وُجد عمود image_url في الاستعلام */
  image_url?: string | null
  images?: string[]
  opening_hours?: Record<string, { open: string; close: string }>
  average_rating?: number
  total_reviews?: number
  total_bookings?: number
  price_range?: string
  is_featured?: boolean
  is_demo?: boolean
  source_type?: 'manual' | 'imported' | 'provider_api' | 'legacy_seed' | 'verified'
  /** Direct link from Google Places (client-side only) */
  google_maps_uri?: string | null
  /** True when row is from Google Places API, not Supabase */
  is_google_place?: boolean
  /** Places API (New) place resource id — مُخزَّن في قاعدة البيانات عند الاستيراد */
  google_place_id?: string | null
  /** أول صورة من Places — يُبنى رابطها في العميل بمفتاح الخرائط */
  google_photo_resource?: string | null
  created_at?: string
  sa_cities?: {
    name_ar: string
    sa_regions?: { name_ar: string } | null
  } | null
}

export type SaRegionRow = {
  id: string
  name_ar: string
  capital_ar: string
  image_url: string
  sort_order: number
  sa_cities?: {
    id: string
    name_ar: string
    businesses?: { id: string; is_demo?: boolean }[] | null
  }[] | null
}

export type Service = {
  id: string
  business_id: string
  name_ar: string
  category: string
  price: number
  duration_minutes: number
}

export type Profile = {
  id: string
  full_name?: string
  phone?: string
  email?: string
  avatar_url?: string
  city?: string
  role?: string
  invite_code?: string
  push_token?: string | null
  is_suspended?: boolean | null
}

export type Product = {
  id: string
  name_ar: string
  brand_ar?: string
  description_ar?: string
  category: string
  image_url?: string
  price: number
  rating?: number
  review_count?: number
  is_demo?: boolean
  source_type?: 'manual' | 'imported' | 'provider_api' | 'legacy_seed' | 'verified'
}
