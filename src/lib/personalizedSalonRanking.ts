import type { Business } from '@/lib/supabase'
import {
  salonAiScore,
  type AiUserProfile,
  type RankableSalon,
} from '@/lib/aiRanking'
import { roseyRecommendationScore, type RoseyScoringContext } from '@/lib/mapRecommendationScoring'
import { businessMatchesSearchCategory } from '@/lib/searchCategoryFilter'
import { businessMatchesServiceType, type RosyServiceType } from '@/lib/roseySalonSuggestions'
import { haversineKm } from '@/lib/utils'
import { isSalonSubscriptionPlan, type SalonSubscriptionPlan } from '@/lib/salonSubscriptionPlans'

/** Weights documented for product/debug — no randomness. */
const SESSION_CAP_LIST = 14
const SESSION_CAP_MAP_OVERLAY = 10

const MAP_W_ROSEY = 1
const MAP_W_AI = 0.12
const MAP_AI_CAP = 22
const MAP_W_SESSION = 0.55

function ratingFallbackScore(salon: RankableSalon): number {
  const rating =
    typeof salon.average_rating === 'number' && Number.isFinite(salon.average_rating)
      ? salon.average_rating
      : 0
  const reviews =
    typeof salon.total_reviews === 'number' && Number.isFinite(salon.total_reviews)
      ? Math.max(0, salon.total_reviews)
      : 0
  return rating * 0.55 + Math.log1p(reviews) * 0.15
}

function safeTotal(n: number, rk: RankableSalon): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return ratingFallbackScore(rk)
  return n
}

function normalizeHay(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function intentHaystack(b: Pick<Business, 'name_ar' | 'name_en' | 'category_label' | 'category' | 'description_ar' | 'city' | 'address_ar'>): string {
  return [b.name_ar, b.name_en, b.category_label, b.category, b.description_ar, b.city, b.address_ar]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export type PersonalizedRankingSignals = {
  /** Canonical label from category chip / URL (`resolveSearchCategoryFilter`) */
  categoryCanonical?: string | null
  /** City name hint — skipped when `cityScopeUniform` (every row already in that city). */
  cityName?: string | null
  /** When true, do not add the generic city-text match term (city listing pages). */
  cityScopeUniform?: boolean
  districtHint?: string | null
  /** Rosy / navigation keywords — must be deterministic: use sorted unique tokens at call site if needed. */
  intentKeywords?: readonly string[]
  preferredServiceType?: RosyServiceType | null
  distanceKm?: number | null
  /**
   * Map + `roseyRecommendationScore`: omit distance / broad intent / redundant city so we do not double-count Rosey.
   */
  mapOverlayMode?: boolean
}

export type PersonalizedListBreakdown = {
  baseAi: number
  sessionContext: number
  total: number
}

export type MapSmartCombinedBreakdown = {
  total: number
  rosey: number
  aiScaled: number
  session: number
  rawAi: number
}

function planTier(p: SalonSubscriptionPlan | null | undefined): number {
  if (p === 'premium') return 3
  if (p === 'pro') return 2
  if (p === 'basic') return 1
  return 0
}

/**
 * Bounded, deterministic session/context layer on top of profile-aware `salonAiScore`.
 * Explainable terms only; no randomness.
 */
export function sessionContextScore(b: Business, signals: PersonalizedRankingSignals): number {
  const overlay = Boolean(signals.mapOverlayMode)
  const cap = overlay ? SESSION_CAP_MAP_OVERLAY : SESSION_CAP_LIST

  let s = 0

  const cat = signals.categoryCanonical?.trim()
  if (cat && businessMatchesSearchCategory(b, cat)) {
    s += 6
  }

  if (!overlay) {
    const city = signals.cityName?.trim()
    if (city && city.length >= 2 && !signals.cityScopeUniform) {
      const cityN = normalizeHay(city)
      const blob = normalizeHay([b.city, b.address_ar, b.name_ar].filter(Boolean).join(' '))
      if (blob.includes(cityN)) {
        s += 4
      }
    }
  }

  const distHint = signals.districtHint?.trim()
  if (distHint && distHint.length >= 2) {
    const dn = normalizeHay(distHint)
    const addr = normalizeHay([b.address_ar, b.name_ar, b.city].filter(Boolean).join(' '))
    if (addr.includes(dn)) {
      s += 3
    }
  }

  const svc = signals.preferredServiceType
  if (svc && businessMatchesServiceType(b, svc)) {
    s += 7
  }

  if (!overlay) {
    const kws = signals.intentKeywords ?? []
    const uniq = [...new Set(kws.map((k) => k.trim().toLowerCase()).filter((x) => x.length >= 2))].sort()
    const hay = intentHaystack(b)
    let kwScore = 0
    for (const kw of uniq) {
      if (hay.includes(kw)) {
        kwScore += 2
      }
    }
    s += Math.min(8, kwScore)

    const dk = signals.distanceKm
    if (dk != null && Number.isFinite(dk) && dk >= 0) {
      s += 4 * (1 - Math.min(1, dk / 35))
    }
  }

  return Math.min(cap, s)
}

export function personalizedListTotal(
  b: Business,
  rankable: RankableSalon,
  signals: PersonalizedRankingSignals,
  userProfile?: AiUserProfile
): PersonalizedListBreakdown {
  const baseAi = salonAiScore(rankable, userProfile)
  const session = sessionContextScore(b, signals)
  const total = safeTotal(baseAi + session, rankable)
  return { baseAi, sessionContext: session, total }
}

export function mapSmartCombinedScore(
  b: Business,
  rankable: RankableSalon,
  roseCtx: RoseyScoringContext,
  overlaySignals: PersonalizedRankingSignals,
  userProfile?: AiUserProfile
): MapSmartCombinedBreakdown {
  const rosey = roseyRecommendationScore(b, roseCtx)
  const rawAi = salonAiScore(rankable, userProfile)
  const session = sessionContextScore(b, { ...overlaySignals, mapOverlayMode: true })
  const aiScaled = Math.min(MAP_AI_CAP, Math.max(0, rawAi * MAP_W_AI))
  const total = MAP_W_ROSEY * rosey + aiScaled + MAP_W_SESSION * session
  return {
    total: safeTotal(total, rankable),
    rosey,
    aiScaled,
    session,
    rawAi,
  }
}

/**
 * Stable tie-breakers aligned with `rankSalons` in `aiRanking` (+ id).
 */
export function compareBusinessesAfterPersonalizedScore(
  a: Business,
  b: Business,
  rankableA: RankableSalon,
  rankableB: RankableSalon
): number {
  const ar = Number(a.average_rating ?? 0)
  const br = Number(b.average_rating ?? 0)
  if (Math.abs(br - ar) > 1e-9) {
    return br - ar
  }
  const atr = Number(a.total_reviews ?? 0)
  const btr = Number(b.total_reviews ?? 0)
  if (btr !== atr) {
    return btr - atr
  }
  const pt = planTier(rankableB.subscription_plan) - planTier(rankableA.subscription_plan)
  if (pt !== 0) {
    return pt
  }
  const ff = (rankableB.is_featured ? 1 : 0) - (rankableA.is_featured ? 1 : 0)
  if (ff !== 0) {
    return ff
  }
  const ad = (rankableB.has_active_featured_ad ? 1 : 0) - (rankableA.has_active_featured_ad ? 1 : 0)
  if (ad !== 0) {
    return ad
  }
  return String(a.id).localeCompare(String(b.id))
}

export function sortBusinessesByPersonalizedListScore<T extends Business>(
  rows: T[],
  args: {
    toRankable: (b: T) => RankableSalon
    baseSignals: PersonalizedRankingSignals
    userProfile?: AiUserProfile
    userPos?: { lat: number; lng: number } | null
  }
): T[] {
  const scored = rows.map((row) => {
    const rk = args.toRankable(row)
    let distanceKm: number | null = args.baseSignals.distanceKm ?? null
    if (distanceKm == null && args.userPos && row.latitude != null && row.longitude != null) {
      distanceKm = haversineKm(args.userPos.lat, args.userPos.lng, row.latitude, row.longitude)
    }
    const signals: PersonalizedRankingSignals = { ...args.baseSignals, distanceKm }
    const { total } = personalizedListTotal(row, rk, signals, args.userProfile)
    return { row, rk, total }
  })
  scored.sort((x, y) => {
    const d = y.total - x.total
    if (Math.abs(d) > 1e-9) {
      return d
    }
    return compareBusinessesAfterPersonalizedScore(x.row, y.row, x.rk, y.rk)
  })
  return scored.map((s) => s.row)
}

/** Parse `?service=` for list/map overlays */
export function parsePreferredServiceParam(raw: string | null | undefined): RosyServiceType | null {
  const k = (raw ?? '').trim().toLowerCase()
  if (k === 'hair' || k === 'nails' || k === 'laser') {
    return k
  }
  return null
}

export function mergeSubscriptionPlan(
  b: Pick<Business, 'subscription_plan'>,
  planFromTable: SalonSubscriptionPlan | undefined
): SalonSubscriptionPlan | null {
  const fromRow = b.subscription_plan
  const a = fromRow && isSalonSubscriptionPlan(fromRow) ? fromRow : null
  const bPlan = planFromTable ?? null
  const rank = (p: SalonSubscriptionPlan | null) => (p === 'premium' ? 3 : p === 'pro' ? 2 : p === 'basic' ? 1 : 0)
  if (rank(bPlan) >= rank(a)) {
    return bPlan
  }
  return a
}
