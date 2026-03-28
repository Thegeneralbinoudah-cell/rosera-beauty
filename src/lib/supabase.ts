import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SalonSubscriptionPlan } from '@/lib/salonSubscriptionPlans'

/**
 * قراءة صريحة من import.meta.env (Vite يحقن VITE_* فقط في العميل).
 * لا تستخدم process.env هنا — لن يعمل في المتصفح.
 */
function readViteEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const raw = import.meta.env[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function isPlaceholderAnonKey(k: string): boolean {
  return /^your_anon_key$/i.test(k) || k.length < 20
}

/**
 * القيم من `.env` / `.env.local` داخل `rosera/` (انظر vite.config دمج المجلد الأعلى).
 * المفتاح: JWT كامل في سطر واحد من Supabase → Settings → API.
 */
const url = readViteEnv('VITE_SUPABASE_URL')
const key = readViteEnv('VITE_SUPABASE_ANON_KEY')

if (!url || !key) {
  console.error('Supabase ENV missing')
}

if (key && isPlaceholderAnonKey(key)) {
  console.error(
    '[Supabase] VITE_SUPABASE_ANON_KEY is missing or still a placeholder — set the full anon JWT from Supabase Dashboard → Settings → API'
  )
}

/** يُستخدم للتحقق قبل الاستدعاءات الحرجة */
export const isSupabaseConfigured =
  url.length > 0 && key.length > 0 && !isPlaceholderAnonKey(key)

if (isSupabaseConfigured) {
  console.info('[Supabase] client initialized', url.replace(/\/$/, ''))
}

/**
 * Canonical KSA geography: `sa_regions` + `sa_cities` (migration 003+).
 * The legacy `public.cities` table from 001 is not used by current app flows — do not query it for new features.
 */

/** عميل Supabase واحد للتطبيق — يُصدَّر للاستيراد من أي مكوّن */
export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    /** Required for OAuth (Apple, Google, etc.): stores code verifier so `/auth/callback` can exchange `?code=` */
    flowType: 'pkce',
  },
})

/** صف أعمال مع ارتباط اختياري بالمدينة (للبحث) */
export type Business = {
  id: string
  name_ar: string
  name_en?: string
  description_ar?: string
  category: string
  /** Canonical app filter: salon | clinic | spa | makeup | skincare (optional; backfilled in DB) */
  category_value?: string | null
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
  /** عند وجود العمود في الاستعلام (مثلاً select *) */
  subscription_plan?: SalonSubscriptionPlan | null
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
  /** Google seed: high = photo + rating > 4; medium = fallback / relaxed pipeline */
  data_quality?: 'high' | 'medium' | null
  /** روزي: اقتراح خدمات/صالونات أرخص */
  rosy_pricing_flexible?: boolean | null
  /** روزي: السماح بخصم إضافي ضمن الحد */
  rosy_discount_allowed?: boolean | null
  /** روزي: حد أقصى لنسبة الخصم (0–15) */
  rosy_max_discount_percent?: number | null
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
  name_en?: string | null
  category: string
  price: number
  duration_minutes: number
  is_active?: boolean | null
  is_demo?: boolean | null
}

export type SalonTeamRow = {
  id: string
  salon_id: string
  name_ar: string
  role_ar: string | null
  image_url: string | null
  sort_order: number
}

/** Customer-facing staff (public.staff) — optional on bookings */
export type StaffMember = {
  id: string
  salon_id: string
  name: string | null
  name_ar: string | null
  specialty: string | null
  specialty_ar: string | null
  rating: number | null
  image_url: string | null
  sort_order: number
}

/**
 * Full `profiles` row — RLS allows only self-read; for **other users’** display names/avatars use
 * `public_profiles` (view) or `public_profiles` queries, never `profiles` for cross-user UI.
 */
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

/** RLS-safe view: id, full_name, avatar_url — use for cross-user display (reviews, salon dashboards). */
export type PublicProfile = {
  id: string
  full_name?: string | null
  avatar_url?: string | null
}

export type Product = {
  id: string
  name_ar: string
  name_en?: string | null
  brand_ar?: string
  brand_en?: string | null
  description_ar?: string
  description_en?: string | null
  category: string
  image_url?: string
  price: number
  rating?: number
  review_count?: number
  is_demo?: boolean
  source_type?: 'manual' | 'imported' | 'provider_api' | 'legacy_seed' | 'verified'
}
