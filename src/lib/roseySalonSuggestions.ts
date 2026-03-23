import { supabase, type Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'
import { markGeolocationKnown } from '@/lib/geoSession'

export type RosySalonSuggestion = {
  id: string
  name_ar: string
  average_rating: number | null
  total_reviews: number | null
  distance_km: number | null
  cover_image?: string | null
  google_photo_resource?: string | null
}

export type RosyPickMode = 'nearest' | 'rating' | 'service'

export type RosyServiceType = 'hair' | 'nails' | 'laser'

const BUSINESS_PICK_FIELDS =
  'id, name_ar, name_en, average_rating, total_reviews, total_bookings, latitude, longitude, cover_image, google_photo_resource, category, category_label, description_ar'

/** كلمات مطابقة لتصنيفات شعر / أظافر / ليزر في البيانات العربية */
const SERVICE_KEYWORDS: Record<RosyServiceType, string[]> = {
  hair: ['شعر', 'تسريح', 'صالون نسائي', 'عناية بالشعر', 'بروتين', 'صبغة', 'كيراتين', 'هايلايت'],
  nails: ['أظافر', 'مانيكير', 'بديكير', 'جل', 'أكريليك'],
  laser: ['ليزر', 'إزالة شعر', 'عيادة ليزر'],
}

export function businessMatchesServiceType(
  b: Pick<Business, 'category' | 'category_label' | 'name_ar' | 'name_en' | 'description_ar'>,
  t: RosyServiceType
): boolean {
  const hay = [b.category, b.category_label, b.name_ar, b.name_en, b.description_ar].filter(Boolean).join(' ')
  if (!hay.trim()) return false
  return SERVICE_KEYWORDS[t].some((kw) => hay.includes(kw))
}

/** طلب الموقع مرة واحدة — يُستخدم من روزي والدليل المحلي */
export function requestBrowserGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords?.latitude
        const lng = p.coords?.longitude
        if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
          markGeolocationKnown()
          resolve({ lat, lng })
          return
        }
        resolve(null)
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  })
}

function mapRow(b: Business, pos: { lat: number; lng: number } | null): RosySalonSuggestion {
  const la = Number(b.latitude)
  const ln = Number(b.longitude)
  let distance_km: number | null = null
  if (pos && Number.isFinite(la) && Number.isFinite(ln)) {
    distance_km = haversineKm(pos.lat, pos.lng, la, ln)
  }
  return {
    id: b.id,
    name_ar: b.name_ar,
    average_rating: b.average_rating != null ? Number(b.average_rating) : null,
    total_reviews: b.total_reviews ?? null,
    distance_km,
    cover_image: b.cover_image,
    google_photo_resource: b.google_photo_resource ?? null,
  }
}

/**
 * يجلب أفضل 3 صالونات: أقرب (مع GPS) أو أعلى تقييمًا.
 */
export async function fetchRosySalonSuggestions(
  mode: 'nearest' | 'rating'
): Promise<{ items: RosySalonSuggestion[]; hadLocation: boolean }> {
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_PICK_FIELDS)
    .eq('is_active', true)
    .eq('is_demo', false)

  if (error) throw error
  const rows = (data ?? []) as Business[]
  if (rows.length === 0) return { items: [], hadLocation: false }

  if (mode === 'rating') {
    const mapped = rows.map((b) => mapRow(b, null))
    mapped.sort((a, b) => {
      const ra = a.average_rating ?? 0
      const rb = b.average_rating ?? 0
      if (rb !== ra) return rb - ra
      return (b.total_reviews ?? 0) - (a.total_reviews ?? 0)
    })
    return { items: mapped.slice(0, 3), hadLocation: false }
  }

  // nearest
  const pos = await requestBrowserGeolocation()
  const hadLocation = pos != null
  const mapped = rows.map((b) => mapRow(b, pos))
  const withDist = mapped.filter((x): x is RosySalonSuggestion & { distance_km: number } => x.distance_km != null)
  withDist.sort((a, b) => a.distance_km - b.distance_km)

  if (withDist.length >= 3) {
    return { items: withDist.slice(0, 3), hadLocation }
  }

  const ids = new Set(withDist.map((x) => x.id))
  const rest = mapped
    .filter((x) => !ids.has(x.id))
    .sort((a, b) => {
      const ra = a.average_rating ?? 0
      const rb = b.average_rating ?? 0
      if (rb !== ra) return rb - ra
      return (b.total_reviews ?? 0) - (a.total_reviews ?? 0)
    })

  return { items: [...withDist, ...rest].slice(0, 3), hadLocation }
}

/**
 * بعد اختيار نوع الخدمة (شعر / أظافر / ليزر): أفضل 3 حسب عدد الحجوزات ضمن المطابقة.
 */
export async function fetchRosySalonsByServiceType(
  serviceType: RosyServiceType
): Promise<{ items: RosySalonSuggestion[] }> {
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_PICK_FIELDS)
    .eq('is_active', true)
    .eq('is_demo', false)

  if (error) throw error
  const rows = ((data ?? []) as Business[]).filter((b) => businessMatchesServiceType(b, serviceType))
  if (rows.length === 0) return { items: [] }

  const mapped = rows
    .map((b) => ({ b, bookings: b.total_bookings ?? 0 }))
    .sort((x, y) => y.bookings - x.bookings)
    .slice(0, 3)
    .map(({ b }) => mapRow(b, null))

  return { items: mapped }
}
