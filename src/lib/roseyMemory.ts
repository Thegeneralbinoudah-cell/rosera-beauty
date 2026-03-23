import { supabase, isSupabaseConfigured, type Business } from '@/lib/supabase'
import { inferPreferenceServiceKey, type PreferenceServiceKey } from '@/lib/roseyUserPreference'
import type { RosyServiceType } from '@/lib/roseySalonSuggestions'

export type RosyMemoryLastBooking = {
  businessId: string
  businessNameAr: string
  servicePhraseAr: string
  emoji: string
  rosyServiceType: RosyServiceType | null
  createdAt: string
}

export type RosyMemoryLayer = {
  lastBooking: RosyMemoryLastBooking | null
  favoriteSalons: { id: string; name_ar: string }[]
}

function unwrapBusiness<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function phraseAndEmojiFromKey(
  key: PreferenceServiceKey | null,
  fallbackServiceName: string
): { phrase: string; emoji: string } {
  if (key === 'nails') return { phrase: 'أظافر', emoji: '💅' }
  if (key === 'hair') return { phrase: 'شعرك', emoji: '💇‍♀️' }
  if (key === 'laser') return { phrase: 'ليزر', emoji: '✨' }
  if (key === 'spa') return { phrase: 'سبا وعناية', emoji: '💆‍♀️' }
  const t = fallbackServiceName.trim()
  if (t) return { phrase: t.length > 40 ? `${t.slice(0, 37)}…` : t, emoji: '✨' }
  return { phrase: 'خدمة العناية', emoji: '💕' }
}

function preferenceKeyToRosyType(key: PreferenceServiceKey | null): RosyServiceType | null {
  if (key === 'nails' || key === 'hair' || key === 'laser') return key
  return null
}

function inferKeyFromServiceText(hay: string): PreferenceServiceKey | null {
  if (/أظافر|مانيكير|بديكير|جل|أكريليك|nail/i.test(hay)) return 'nails'
  if (/شعر|صبغ|بروتين|كيراتين|تسريح|هايلايت/i.test(hay)) return 'hair'
  if (/ليزر|إزالة\s*شعر|ipl/i.test(hay)) return 'laser'
  if (/سبا|مساج|حمام\s*مغربي/i.test(hay)) return 'spa'
  return null
}

/**
 * ذاكرة روزي: آخر حجز (مع نوع الخدمة) + المفضلة — بدون جدول جديد، من bookings / favorites.
 */
export async function fetchRosyMemoryLayer(userId: string): Promise<RosyMemoryLayer> {
  const empty: RosyMemoryLayer = { lastBooking: null, favoriteSalons: [] }
  if (!isSupabaseConfigured || !userId) return empty

  const [bookingRes, favRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, created_at, booking_date, service_id, service_ids, business_id, status, businesses ( id, name_ar, category, category_label, name_en, description_ar )'
      )
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('favorites')
      .select('created_at, businesses ( id, name_ar )')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  type BizMini = { id?: string; name_ar?: string | null }
  type BizForInfer = Pick<Business, 'id' | 'category' | 'category_label' | 'name_ar' | 'name_en' | 'description_ar'>

  const favoriteSalons: { id: string; name_ar: string }[] = []
  for (const row of favRes.data ?? []) {
    const biz = unwrapBusiness((row as { businesses?: BizMini | BizMini[] | null }).businesses)
    if (biz?.id && typeof biz.name_ar === 'string' && biz.name_ar.trim()) {
      favoriteSalons.push({ id: biz.id, name_ar: biz.name_ar.trim() })
    }
  }

  if (bookingRes.error || !bookingRes.data) {
    return { lastBooking: null, favoriteSalons }
  }

  const booking = bookingRes.data as unknown as {
    id: string
    created_at: string
    booking_date: string
    service_id: string | null
    service_ids: string[] | null
    business_id: string
    businesses?: BizForInfer | BizForInfer[] | null
  }

  const biz = unwrapBusiness(booking.businesses)
  if (!biz?.id) {
    return { lastBooking: null, favoriteSalons }
  }

  const ids = [
    booking.service_id,
    ...((Array.isArray(booking.service_ids) ? booking.service_ids : []) as string[]),
  ].filter((x): x is string => typeof x === 'string' && x.length > 0)
  const uniqueIds = [...new Set(ids)]

  let serviceHay = ''
  let firstSvcName = ''
  if (uniqueIds.length > 0) {
    const { data: svcRows } = await supabase.from('services').select('name_ar, category').in('id', uniqueIds)
    const rows = (svcRows ?? []) as { name_ar?: string; category?: string }[]
    for (const r of rows) {
      if (!firstSvcName && r.name_ar?.trim()) firstSvcName = r.name_ar.trim()
      serviceHay += ` ${r.name_ar ?? ''} ${r.category ?? ''}`
    }
  }

  let key = inferPreferenceServiceKey({
    category: biz.category ?? '',
    category_label: biz.category_label ?? undefined,
    name_ar: biz.name_ar ?? '',
    name_en: biz.name_en ?? undefined,
    description_ar: biz.description_ar ?? undefined,
  })
  if (!key && serviceHay.trim()) key = inferKeyFromServiceText(serviceHay)

  const { phrase, emoji } = phraseAndEmojiFromKey(key, firstSvcName || serviceHay.trim())

  const lastBooking: RosyMemoryLastBooking = {
    businessId: biz.id,
    businessNameAr: biz.name_ar?.trim() || 'صالونك',
    servicePhraseAr: phrase,
    emoji,
    rosyServiceType: preferenceKeyToRosyType(key),
    createdAt: booking.created_at,
  }

  return { lastBooking, favoriteSalons }
}
