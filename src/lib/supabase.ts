import { createClient } from '@supabase/supabase-js'

/**
 * القيم من `.env` أو `.env.local` (Vite يدمجهما؛ `.env.local` له أولوية).
 * المفتاح يجب أن يكون سطراً واحداً كاملاً بدون قطع — انسخيه من Supabase → Settings → API.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (import.meta.env.DEV && (!url?.trim() || !key?.trim())) {
  console.warn('[Rosera] عرّفي VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env أو .env.local')
} else if (import.meta.env.DEV && key && key.length < 100) {
  console.warn('[Rosera] يبدو أن VITE_SUPABASE_ANON_KEY غير كامل — تأكدي أنه JWT كامل في سطر واحد')
}

export const supabase = createClient(url ?? '', key ?? '')

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
  images?: string[]
  opening_hours?: Record<string, { open: string; close: string }>
  average_rating?: number
  total_reviews?: number
  total_bookings?: number
  price_range?: string
  is_featured?: boolean
  is_demo?: boolean
  source_type?: 'manual' | 'imported' | 'provider_api' | 'legacy_seed'
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
    businesses: { id: string; is_demo?: boolean }[] | null
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
  source_type?: 'manual' | 'imported' | 'provider_api' | 'legacy_seed'
}
