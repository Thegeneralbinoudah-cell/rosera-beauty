import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'
import { getTimeOfDay, type TimeOfDay } from '@/lib/mapRecommendationScoring'

/** أنماط الترتيب المدعومة من طبقة «روزي» — بدون إزالة أوضاع الفرز الحالية */
export type MapSortMode = 'rating' | 'booked' | 'nearest' | 'name' | 'newest' | 'value' | 'smart'

export type MapSuggestionId =
  | 'rosy_smart'
  | 'rosy_near_top'
  | 'rosy_top_rated'
  | 'rosy_quick_book'
  | 'rosy_trending'
  | 'rosy_best_value'
  | 'rosy_skin'
  | 'rosy_hair'
  | 'rosy_nails'

export type MapSuggestion = {
  id: MapSuggestionId
  sortBy: MapSortMode
  /** نص بحث اختياري يُطبَّق مع الاقتراح (فئات) */
  searchQuery?: string
  /** يتطلب إحداثيات المستخدم لمعنى «الأقرب» */
  requiresLocation?: boolean
  labels: { ar: string; en: string }
}

const SUGGESTIONS_BASE: Omit<MapSuggestion, 'labels'>[] = [
  { id: 'rosy_smart', sortBy: 'smart' },
  { id: 'rosy_near_top', sortBy: 'nearest', requiresLocation: true },
  { id: 'rosy_top_rated', sortBy: 'rating' },
  { id: 'rosy_trending', sortBy: 'booked' },
  /** يميّز عن «الأكثر طلبًا» — قيمة متوازنة لقرار سريع */
  { id: 'rosy_quick_book', sortBy: 'value' },
  { id: 'rosy_best_value', sortBy: 'value' },
  { id: 'rosy_skin', sortBy: 'rating', searchQuery: 'بشرة' },
  { id: 'rosy_hair', sortBy: 'rating', searchQuery: 'شعر' },
  { id: 'rosy_nails', sortBy: 'rating', searchQuery: 'أظافر' },
]

/** تسميات ديناميكية — تُحدَّث حسب السياق في getMapSuggestions */
const LABELS: Record<MapSuggestionId, { ar: string; en: string }> = {
  rosy_smart: {
    ar: 'ترشيح روزي ✨',
    en: 'Rosy pick ✨',
  },
  rosy_near_top: {
    ar: 'الأقرب لك الآن',
    en: 'Nearest to you now',
  },
  rosy_top_rated: {
    ar: 'الأعلى تقييمًا',
    en: 'Top rated',
  },
  rosy_trending: {
    ar: 'الأكثر طلبًا',
    en: 'Most booked',
  },
  rosy_quick_book: {
    ar: 'مناسب لحجز سريع',
    en: 'Quick booking friendly',
  },
  rosy_best_value: {
    ar: 'أفضل قيمة',
    en: 'Best value',
  },
  rosy_skin: {
    ar: 'عناية بالبشرة',
    en: 'Skin care',
  },
  rosy_hair: {
    ar: 'شعر وتصفيف',
    en: 'Hair',
  },
  rosy_nails: {
    ar: 'أظافر',
    en: 'Nails',
  },
}

export type MapSuggestionInputContext = {
  hasUserLocation: boolean
  /** يُفضَّل تمرير نفس المرجع للدقيقة (دقيقة/ساعة) — لا يُستدعى عند تحريك الخريطة */
  now: Date
  searchQuery: string
  /** كلمات من المحادثة أو جلسة التنقل */
  chatKeywords: string[]
}

export const ROSEY_MAP_SESSION_KEY = 'rosey:mapSuggestionId'
/** JSON: { "keywords": string[] } — يُضبط من الشات قبل الانتقال للخريطة */
export const ROSEY_MAP_CHAT_HINTS_KEY = 'rosey:mapChatHints'

export function readMapChatHintsFromSession(): string[] {
  try {
    const raw = sessionStorage.getItem(ROSEY_MAP_CHAT_HINTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { keywords?: unknown }
    const k = parsed.keywords
    if (!Array.isArray(k)) return []
    return k.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
  } catch {
    return []
  }
}

/** يستدعيه الشات أو شاشات أخرى قبل `navigate('/map')` */
export function setMapChatHintsSession(keywords: string[]): void {
  try {
    if (!keywords.length) {
      sessionStorage.removeItem(ROSEY_MAP_CHAT_HINTS_KEY)
      return
    }
    sessionStorage.setItem(ROSEY_MAP_CHAT_HINTS_KEY, JSON.stringify({ keywords }))
  } catch {
    /* ignore */
  }
}

function categoryHintMatches(id: MapSuggestionId, keywords: string[], q: string): boolean {
  const hay = `${q} ${keywords.join(' ')}`.toLowerCase()
  if (id === 'rosy_skin') return /بشرة|skin|facial|facial/i.test(hay)
  if (id === 'rosy_hair') return /شعر|hair|صبغ|كيراتين/i.test(hay)
  if (id === 'rosy_nails') return /أظافر|اظافر|nail|مانيكير/i.test(hay)
  return false
}

/** ترتيب الشرائح حسب الوقت + الموقع + المحادثة — بدون مرور على كل المنشآت */
function chipPriority(id: MapSuggestionId, ctx: MapSuggestionInputContext): number {
  const tod: TimeOfDay = getTimeOfDay(ctx.now)
  let w = 0
  if (id === 'rosy_smart') w += 1000
  if (id === 'rosy_near_top' && ctx.hasUserLocation) w += 180
  if (id === 'rosy_top_rated') w += 120
  if (id === 'rosy_trending') {
    w += tod === 'evening' || tod === 'afternoon' ? 140 : 100
  }
  if (id === 'rosy_quick_book') {
    w += tod === 'morning' ? 130 : 90
  }
  if (id === 'rosy_best_value') w += 70
  if (id === 'rosy_skin' || id === 'rosy_hair' || id === 'rosy_nails') {
    w += categoryHintMatches(id, ctx.chatKeywords, ctx.searchQuery) ? 160 : 25
  }
  return w
}

export function getMapSuggestions(ctx: MapSuggestionInputContext): MapSuggestion[] {
  const list = SUGGESTIONS_BASE.map((s) => ({
    ...s,
    labels: LABELS[s.id],
  })).filter((s) => {
    if (s.requiresLocation && !ctx.hasUserLocation) return false
    return true
  })

  return [...list].sort((a, b) => chipPriority(b.id, ctx) - chipPriority(a.id, ctx))
}

export function getSuggestionById(id: MapSuggestionId): MapSuggestion | undefined {
  const base = SUGGESTIONS_BASE.find((s) => s.id === id)
  if (!base) return undefined
  return { ...base, labels: LABELS[id] }
}

export function labelForSuggestion(s: MapSuggestion, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? s.labels.ar : s.labels.en
}

/** درجة «قيمة» خفيفة — للفرز حسب قيمة تقليدية */
export function businessValueScore(b: Business): number {
  const r = Number(b.average_rating ?? 0)
  const rev = Number(b.total_reviews ?? 0)
  const book = Number(b.total_bookings ?? 0)
  if (!Number.isFinite(r) || r <= 0) return 0
  return r * Math.log1p(rev + 1) * (1 + Math.log1p(book) * 0.08)
}

/** معرفات للتمييز على الخريطة — أول N بعد الفرز الحالي */
export function sliceHighlightIdsFromOrdered(filteredOrdered: Business[], max = 8): string[] {
  const out: string[] = []
  for (const b of filteredOrdered) {
    if (b.id == null) continue
    out.push(String(b.id))
    if (out.length >= max) break
  }
  return out
}

export function distanceKm(
  user: [number, number] | null,
  b: Pick<Business, 'latitude' | 'longitude'>
): number | null {
  if (!user) return null
  const la = Number(b.latitude)
  const ln = Number(b.longitude)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return haversineKm(user[0], user[1], la, ln)
}

/** مطابقة اختيارية من `?rosy=` في الرابط — مفتاح قصير أو معرف كامل */
export function parseRosyUrlParam(raw: string | null): MapSuggestionId | null {
  if (!raw) return null
  const k = raw.trim()
  const lower = k.toLowerCase()
  if (LABELS[k as MapSuggestionId]) return k as MapSuggestionId
  const map: Record<string, MapSuggestionId> = {
    near: 'rosy_near_top',
    nearest: 'rosy_near_top',
    top: 'rosy_top_rated',
    rating: 'rosy_top_rated',
    quick: 'rosy_quick_book',
    trending: 'rosy_trending',
    value: 'rosy_best_value',
    skin: 'rosy_skin',
    hair: 'rosy_hair',
    nails: 'rosy_nails',
    smart: 'rosy_smart',
    pick: 'rosy_smart',
    rosey: 'rosy_smart',
  }
  return map[lower] ?? null
}
