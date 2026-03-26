import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'

/** أوزان أساسية — مجموع الأجزاء المعيارية ≈ نطاق مستقر للمقارنة */
const W_RATING = 4
const W_REVIEWS = 2
const W_DISTANCE = 3.5
const W_POPULARITY = 2.5
const W_BOOST_FEATURED = 0.45
const W_BOOST_PREMIUM = 0.25
const W_CATEGORY_MATCH = 5
const W_SEARCH_MATCH = 4

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export type RoseyScoringContext = {
  userPos: [number, number] | null
  /** أقصى مسافة ضمن المرشحين الحاليين — لتطبيع المسافة */
  maxDistKm: number
  timeOfDay: TimeOfDay
  searchQuery: string
  chatKeywords: string[]
}

export function getTimeOfDay(date: Date): TimeOfDay {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

/** تعديلات خفيفة حسب الوقت — لا تُعاد حسابها عند تحريك الخريطة */
function timeWeights(tod: TimeOfDay): {
  rating: number
  reviews: number
  distance: number
  popularity: number
  boost: number
} {
  switch (tod) {
    case 'morning':
      return { rating: 1.05, reviews: 1, distance: 1.12, popularity: 1.05, boost: 1 }
    case 'afternoon':
      return { rating: 1, reviews: 1.02, distance: 1.08, popularity: 1.08, boost: 1 }
    case 'evening':
      return { rating: 1.02, reviews: 1.03, distance: 1.1, popularity: 1.12, boost: 1.02 }
    case 'night':
      return { rating: 1.08, reviews: 1.05, distance: 0.92, popularity: 0.98, boost: 1 }
    default:
      return { rating: 1, reviews: 1, distance: 1, popularity: 1, boost: 1 }
  }
}

export function distanceKm(
  user: [number, number],
  b: Pick<Business, 'latitude' | 'longitude'>
): number | null {
  const la = Number(b.latitude)
  const ln = Number(b.longitude)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return haversineKm(user[0], user[1], la, ln)
}

/** أقصى مسافة (كم) بين المستخدم والمرشحين — لتطبيع المسافة */
export function computeMaxDistanceKm(
  rows: Business[],
  userPos: [number, number] | null
): number {
  if (!userPos || rows.length === 0) return 25
  let max = 0.5
  for (const b of rows) {
    const km = distanceKm(userPos, b)
    if (km != null && km > max) max = km
  }
  return Math.min(max, 80)
}

function normRating(r: number): number {
  return Math.max(0, Math.min(1, r / 5))
}

function normLog(n: number, cap: number): number {
  return Math.log1p(Math.max(0, n)) / Math.log1p(cap)
}

function categoryMatchBoost(b: Business, keywords: string[]): number {
  if (!keywords.length) return 0
  const hay = [b.category_label, b.name_ar, b.name_en, b.description_ar]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  let hits = 0
  for (const k of keywords) {
    const t = k.trim().toLowerCase()
    if (t.length >= 2 && hay.includes(t)) hits += 1
  }
  return Math.min(0.15, hits * 0.05)
}

function searchQueryBoost(b: Business, q: string): number {
  const qq = q.trim().toLowerCase()
  if (qq.length < 2) return 0
  const hay = [b.name_ar, b.city, b.category_label].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(qq) ? 0.12 : 0
}

/**
 * درجة ترشيح موحّدة:
 * rating + reviews + distance + popularity + boost(featured/premium) + سياق (وقت، محادثة، بحث)
 */
export function roseyRecommendationScore(b: Business, ctx: RoseyScoringContext): number {
  const w = timeWeights(ctx.timeOfDay)
  const r = Number(b.average_rating ?? 0)
  const ratingPart = normRating(Number.isFinite(r) ? r : 0) * W_RATING * w.rating

  const rev = Number(b.total_reviews ?? 0)
  const reviewPart = normLog(rev, 120) * W_REVIEWS * w.reviews

  let distPart = 0
  if (ctx.userPos) {
    const km = distanceKm(ctx.userPos, b)
    if (km != null) {
      const maxD = Math.max(ctx.maxDistKm, 0.5)
      const closeness = Math.max(0, 1 - Math.min(1, km / maxD))
      distPart = closeness * W_DISTANCE * w.distance
    }
  }

  const book = Number(b.total_bookings ?? 0)
  const popPart = normLog(book, 60) * W_POPULARITY * w.popularity

  let boostPart = 0
  if (b.is_featured) boostPart += W_BOOST_FEATURED * w.boost
  if (b.subscription_plan === 'premium') boostPart += W_BOOST_PREMIUM * w.boost

  const catPart = categoryMatchBoost(b, ctx.chatKeywords) * W_CATEGORY_MATCH
  const qPart = searchQueryBoost(b, ctx.searchQuery) * W_SEARCH_MATCH

  return ratingPart + reviewPart + distPart + popPart + boostPart + catPart + qPart
}

export function buildRoseyScoringContext(opts: {
  userPos: [number, number] | null
  candidates: Business[]
  now: Date
  searchQuery: string
  chatKeywords: string[]
}): RoseyScoringContext {
  return {
    userPos: opts.userPos,
    maxDistKm: computeMaxDistanceKm(opts.candidates, opts.userPos),
    timeOfDay: getTimeOfDay(opts.now),
    searchQuery: opts.searchQuery,
    chatKeywords: opts.chatKeywords,
  }
}
