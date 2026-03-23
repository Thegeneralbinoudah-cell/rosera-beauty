import { supabase, isSupabaseConfigured, type Business } from '@/lib/supabase'
import { fetchBestActiveOffersByBusinessIds, type SalonActiveOffer } from '@/lib/offers'

export type PreferredCategory = 'hair' | 'spa' | 'nails'

export type RankableSalon = {
  id: string
  average_rating?: number | null
  total_reviews?: number | null
  category?: string | null
  category_label?: string | null
  activeOffer?: SalonActiveOffer | null
}

export type AiUserProfile = {
  preferredCategories?: PreferredCategory[]
  favoriteSalonIds?: Set<string>
  salonBookingCounts?: Map<string, number>
  bookedCategoryCounts?: Map<string, number>
}

export type RankedSalon<T extends RankableSalon = RankableSalon> = T & {
  score: number
  aiScore: number
  isRecommended: boolean
}

function safeFinite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback
}

function ratingFallbackScore(salon: RankableSalon): number {
  const rating = typeof salon.average_rating === 'number' && Number.isFinite(salon.average_rating) ? salon.average_rating : 0
  const reviews = typeof salon.total_reviews === 'number' && Number.isFinite(salon.total_reviews) ? Math.max(0, salon.total_reviews) : 0
  return rating * 0.55 + Math.log1p(reviews) * 0.15
}

function salonCategoryBlob(s: RankableSalon): string {
  const c = (s.category || '').toLowerCase()
  const l = (s.category_label || '').toLowerCase()
  return `${c} ${l}`
}

function matchesPreferredCategory(s: RankableSalon, pref: PreferredCategory): boolean {
  const blob = salonCategoryBlob(s)
  if (pref === 'hair') return /\bhair\b|شعر|صالون\s*شعر|تصفيف/i.test(blob)
  if (pref === 'spa') return /\bspa\b|سبا|حمام\s*مغربي/i.test(blob)
  if (pref === 'nails') return /\bnails?\b|أظافر|مناكير|بديكير|nail/i.test(blob)
  return false
}

function categoryMatchValue(salon: RankableSalon, p: AiUserProfile): number {
  let m = 0
  const prefs = p.preferredCategories ?? []
  for (const pref of prefs) {
    if (matchesPreferredCategory(salon, pref)) m = Math.max(m, 5)
  }
  if (m > 0) return m
  const cat = (salon.category || '').trim().toLowerCase()
  if (!cat) return 0
  const bc = p.bookedCategoryCounts
  if (!bc?.size) return 0
  const cnt = bc.get(cat) ?? 0
  if (cnt <= 0) return 0
  return Math.min(5, 2 + Math.min(cnt, 3))
}

function userBehaviorValue(salon: RankableSalon, p: AiUserProfile): number {
  let v = 0
  if (p.favoriteSalonIds?.has(salon.id)) v += 3
  const bn = p.salonBookingCounts?.get(salon.id) ?? 0
  if (bn > 0) v += Math.min(bn, 5) * 0.55
  const cat = (salon.category || '').trim().toLowerCase()
  if (cat && (p.bookedCategoryCounts?.get(cat) ?? 0) > 0) v += 1.2
  return Math.min(5, v)
}

function hasPersonalizationSignals(p?: AiUserProfile): boolean {
  if (!p) return false
  if (p.preferredCategories?.length) return true
  if (p.favoriteSalonIds && p.favoriteSalonIds.size > 0) return true
  if (p.salonBookingCounts && p.salonBookingCounts.size > 0) return true
  if (p.bookedCategoryCounts && p.bookedCategoryCounts.size > 0) return true
  return false
}

function offerBoostScore(salon: RankableSalon): number {
  const o = salon.activeOffer
  if (!o) return 0
  const d = typeof o.discount_percentage === 'number' && Number.isFinite(o.discount_percentage) ? o.discount_percentage : 0
  if (d <= 0) return 0
  const clamped = Math.min(100, Math.max(0, d))
  return Math.min(3, 0.75 + clamped / 25)
}

/**
 * score =
 *   (average_rating * 0.4) +
 *   (log(total_reviews + 1) * 0.2) +
 *   (category_match * 0.2) +
 *   (user_behavior * 0.2)
 */
export function salonAiScore(salon: RankableSalon, userProfile?: AiUserProfile): number {
  const rating = typeof salon.average_rating === 'number' && Number.isFinite(salon.average_rating) ? salon.average_rating : 0
  const reviews = typeof salon.total_reviews === 'number' && Number.isFinite(salon.total_reviews) ? Math.max(0, salon.total_reviews) : 0
  const logRev = Math.log(reviews + 1)
  const personal = hasPersonalizationSignals(userProfile)
  const catTerm = personal && userProfile ? categoryMatchValue(salon, userProfile) : 0
  const behTerm = personal && userProfile ? userBehaviorValue(salon, userProfile) : 0
  const raw = rating * 0.4 + logRev * 0.2 + catTerm * 0.2 + behTerm * 0.2 + offerBoostScore(salon)
  if (!Number.isFinite(raw) || Number.isNaN(raw)) return ratingFallbackScore(salon)
  return raw
}

export function rankSalons<T extends RankableSalon>(salons: T[], userProfile?: AiUserProfile): RankedSalon<T>[] {
  const scored = salons.map((s) => {
    const computed = salonAiScore(s, userProfile)
    const fb = ratingFallbackScore(s)
    const score = safeFinite(computed, fb)
    return { ...s, score, aiScore: score }
  })
  scored.sort((a, b) => {
    const sa = safeFinite(a.score, ratingFallbackScore(a))
    const sb = safeFinite(b.score, ratingFallbackScore(b))
    const d = sb - sa
    if (Math.abs(d) > 1e-9) return d
    const ar =
      typeof a.average_rating === 'number' && Number.isFinite(a.average_rating) ? a.average_rating : 0
    const br =
      typeof b.average_rating === 'number' && Number.isFinite(b.average_rating) ? b.average_rating : 0
    const rb = br - ar
    if (rb !== 0) return rb
    const atr =
      typeof a.total_reviews === 'number' && Number.isFinite(a.total_reviews) ? a.total_reviews : 0
    const btr =
      typeof b.total_reviews === 'number' && Number.isFinite(b.total_reviews) ? b.total_reviews : 0
    return btr - atr
  })
  return scored.map((item, index) => ({
    ...item,
    score: safeFinite(item.score, ratingFallbackScore(item)),
    aiScore: safeFinite(item.aiScore, ratingFallbackScore(item)),
    isRecommended: index < 3,
  }))
}

export async function fetchAiUserProfile(userId: string): Promise<AiUserProfile> {
  const [favRes, bookRes] = await Promise.all([
    supabase.from('favorites').select('business_id').eq('user_id', userId),
    supabase.from('bookings').select('business_id').eq('user_id', userId),
  ])

  const favoriteSalonIds = new Set<string>()
  for (const row of favRes.data ?? []) {
    const id = row.business_id as string
    if (id) favoriteSalonIds.add(id)
  }

  const salonBookingCounts = new Map<string, number>()
  for (const row of bookRes.data ?? []) {
    const id = row.business_id as string
    if (!id) continue
    salonBookingCounts.set(id, (salonBookingCounts.get(id) ?? 0) + 1)
  }

  const bookedCategoryCounts = new Map<string, number>()
  const allIds = [...new Set([...favoriteSalonIds, ...salonBookingCounts.keys()])]
  if (allIds.length > 0) {
    const { data: bizRows } = await supabase.from('businesses').select('id,category').in('id', allIds)
    for (const row of bizRows ?? []) {
      const cat = (row.category || '').trim().toLowerCase()
      if (!cat) continue
      const w = (favoriteSalonIds.has(row.id) ? 1 : 0) + (salonBookingCounts.get(row.id) ?? 0)
      if (w <= 0) continue
      bookedCategoryCounts.set(cat, (bookedCategoryCounts.get(cat) ?? 0) + w)
    }
  }

  return { favoriteSalonIds, salonBookingCounts, bookedCategoryCounts }
}

export type RecommendedSalon = RankedSalon<Business & { activeOffer?: SalonActiveOffer | null }>

export async function getRecommendedSalons(
  userId: string | null | undefined,
  options?: { limit?: number; poolLimit?: number; preferredCategories?: PreferredCategory[] }
): Promise<RecommendedSalon[]> {
  const limit = options?.limit ?? 12
  const poolLimit = options?.poolLimit ?? 220

  if (!isSupabaseConfigured) return []

  const { data: pool, error: poolErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(poolLimit)

  if (poolErr || !pool?.length) return []

  const businesses = pool as Business[]
  const offerMap = await fetchBestActiveOffersByBusinessIds(businesses.map((b) => b.id))
  const withOffers = businesses.map((b) => ({
    ...b,
    activeOffer: offerMap.get(b.id) ?? null,
  }))

  let userProfile: AiUserProfile | undefined
  if (userId) {
    const base = await fetchAiUserProfile(userId)
    userProfile = {
      ...base,
      preferredCategories: options?.preferredCategories?.length
        ? options.preferredCategories
        : base.preferredCategories,
    }
  } else if (options?.preferredCategories?.length) {
    userProfile = { preferredCategories: options.preferredCategories }
  }

  const ranked = rankSalons(withOffers, userProfile)
  return ranked.slice(0, limit) as RecommendedSalon[]
}
