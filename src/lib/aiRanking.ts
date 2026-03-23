import { supabase, isSupabaseConfigured, type Business } from '@/lib/supabase'
import { fetchBestActiveOffersByBusinessIds, type SalonActiveOffer } from '@/lib/offers'
import { haversineKm } from '@/lib/utils'
import { businessMatchesServiceType, type RosyServiceType } from '@/lib/roseySalonSuggestions'
import { ROSY_BOOKING_ASSISTANT_SUBTITLE, ROSY_BOOKING_ASSISTANT_TITLE } from '@/lib/roseyChatCopy'
import { fetchRosyMemoryLayer, type RosyMemoryLayer } from '@/lib/roseyMemory'
import { isSalonSubscriptionPlan, type SalonSubscriptionPlan } from '@/lib/salonSubscriptionPlans'
import { FEATURED_AD_AI_RANK_BOOST, fetchActiveSalonFeaturedAdSalonIds } from '@/lib/salonAds'

export type PreferredCategory = 'hair' | 'spa' | 'nails' | 'laser'

export type RankableSalon = {
  id: string
  average_rating?: number | null
  total_reviews?: number | null
  category?: string | null
  category_label?: string | null
  city?: string | null
  price_range?: string | null
  activeOffer?: SalonActiveOffer | null
  /** Active paid B2B plan (not expired) */
  subscription_plan?: SalonSubscriptionPlan | null
  is_featured?: boolean | null
  /** Paid featured ad campaign (salon_ads) */
  has_active_featured_ad?: boolean | null
}

export type AiUserProfile = {
  preferredCategories?: PreferredCategory[]
  favoriteSalonIds?: Set<string>
  salonBookingCounts?: Map<string, number>
  bookedCategoryCounts?: Map<string, number>
  /** From user_preference events (decayed) */
  preferredPriceRange?: string | null
  preferredLocationHints?: string[]
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
  if (pref === 'laser') return /\blaser\b|ليزر|إزالة\s*شعر|ipl\b/i.test(blob)
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
  if (p.preferredPriceRange?.trim()) return true
  if (p.preferredLocationHints && p.preferredLocationHints.length > 0) return true
  return false
}

function locationPreferenceBoost(salon: RankableSalon, p: AiUserProfile): number {
  const hints = p.preferredLocationHints
  if (!hints?.length) return 0
  const city = (salon.city || '').trim().toLowerCase()
  if (!city) return 0
  for (const h of hints) {
    const x = h.trim().toLowerCase()
    if (!x) continue
    if (city === x || city.includes(x) || x.includes(city)) return 2.8
  }
  return 0
}

function priceRangePreferenceBoost(salon: RankableSalon, p: AiUserProfile): number {
  const pref = p.preferredPriceRange?.trim()
  if (!pref) return 0
  const pr = (salon.price_range || '').trim()
  if (!pr) return 0
  return pr === pref ? 2.2 : 0
}

function offerBoostScore(salon: RankableSalon): number {
  const o = salon.activeOffer
  if (!o) return 0
  const d = typeof o.discount_percentage === 'number' && Number.isFinite(o.discount_percentage) ? o.discount_percentage : 0
  if (d <= 0) return 0
  const clamped = Math.min(100, Math.max(0, d))
  return Math.min(3, 0.75 + clamped / 25)
}

function subscriptionMonetizationBoost(salon: RankableSalon): number {
  const p = salon.subscription_plan
  if (p === 'premium') return 50
  if (p === 'pro') return 25
  return 0
}

function featuredListingBoost(salon: RankableSalon): number {
  return salon.is_featured ? 40 : 0
}

function featuredAdCampaignBoost(salon: RankableSalon): number {
  return salon.has_active_featured_ad ? FEATURED_AD_AI_RANK_BOOST : 0
}

function subscriptionPlanTier(p: SalonSubscriptionPlan | null | undefined): number {
  if (p === 'premium') return 3
  if (p === 'pro') return 2
  if (p === 'basic') return 1
  return 0
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
  const locBoost = personal && userProfile ? locationPreferenceBoost(salon, userProfile) : 0
  const priceBoost = personal && userProfile ? priceRangePreferenceBoost(salon, userProfile) : 0
  const raw =
    rating * 0.36 +
    logRev * 0.18 +
    catTerm * 0.2 +
    behTerm * 0.18 +
    locBoost * 0.04 +
    priceBoost * 0.04 +
    offerBoostScore(salon) +
    subscriptionMonetizationBoost(salon) +
    featuredListingBoost(salon) +
    featuredAdCampaignBoost(salon)
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
    const revDiff = btr - atr
    if (revDiff !== 0) return revDiff
    const pt = subscriptionPlanTier(b.subscription_plan) - subscriptionPlanTier(a.subscription_plan)
    if (pt !== 0) return pt
    const ff = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
    if (ff !== 0) return ff
    return (b.has_active_featured_ad ? 1 : 0) - (a.has_active_featured_ad ? 1 : 0)
  })
  return scored.map((item, index) => ({
    ...item,
    score: safeFinite(item.score, ratingFallbackScore(item)),
    aiScore: safeFinite(item.aiScore, ratingFallbackScore(item)),
    isRecommended: index < 3,
  }))
}

const PREF_EVENT_HALFLIFE_DAYS = 14

function prefDecayFactor(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / PREF_EVENT_HALFLIFE_DAYS)
}

function serviceKeyToPreferredCategory(key: string): PreferredCategory | null {
  const k = key.trim().toLowerCase()
  if (k === 'nails') return 'nails'
  if (k === 'hair') return 'hair'
  if (k === 'spa') return 'spa'
  if (k === 'laser') return 'laser'
  return null
}

export type UserPreferenceSignals = {
  preferredCategories: PreferredCategory[]
  preferredPriceRange: string | null
  preferredLocationHints: string[]
}

/**
 * Aggregates user_preference rows (with metadata) into category / city / price hints.
 */
export async function fetchUserPreferenceSignals(userId: string): Promise<UserPreferenceSignals> {
  const empty: UserPreferenceSignals = {
    preferredCategories: [],
    preferredPriceRange: null,
    preferredLocationHints: [],
  }
  const { data, error } = await supabase
    .from('user_events')
    .select('metadata, created_at')
    .eq('user_id', userId)
    .eq('event_type', 'user_preference')
    .order('created_at', { ascending: false })
    .limit(120)

  if (error || !data?.length) return empty

  const serviceScores = new Map<string, number>()
  const locScores = new Map<string, number>()
  const locDisplay = new Map<string, string>()
  const priceScores = new Map<string, number>()

  for (const row of data) {
    const w = prefDecayFactor(row.created_at as string)
    const m = row.metadata as Record<string, unknown> | null
    if (!m || typeof m !== 'object') continue
    const src = typeof m.source === 'string' ? m.source : ''
    const mult =
      src === 'book' ? 1.25 : src === 'favorite' ? 1.15 : src === 'salon_card_book' ? 1.1 : src === 'salon_page_view' ? 0.9 : 1

    const svc = typeof m.service === 'string' && m.service.trim() ? m.service.trim().toLowerCase() : null
    if (svc) serviceScores.set(svc, (serviceScores.get(svc) ?? 0) + w * mult)

    const loc = typeof m.location === 'string' && m.location.trim() ? m.location.trim() : null
    if (loc) {
      const key = loc.toLowerCase()
      locScores.set(key, (locScores.get(key) ?? 0) + w * mult)
      if (!locDisplay.has(key)) locDisplay.set(key, loc)
    }

    const pr = typeof m.price_range === 'string' && m.price_range.trim() ? m.price_range.trim() : null
    if (pr) priceScores.set(pr, (priceScores.get(pr) ?? 0) + w * mult)
  }

  const MIN_SVC = 0.45
  const preferredCategories: PreferredCategory[] = []
  const sortedSvc = [...serviceScores.entries()].sort((a, b) => b[1] - a[1])
  for (const [key, score] of sortedSvc) {
    if (score < MIN_SVC) break
    const cat = serviceKeyToPreferredCategory(key)
    if (cat && !preferredCategories.includes(cat)) preferredCategories.push(cat)
  }

  const preferredPriceRange = [...priceScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const preferredLocationHints = [...locScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => locDisplay.get(k) ?? k)

  return { preferredCategories, preferredPriceRange, preferredLocationHints }
}

/** Rosy chat: أقرب نوع خدمة للفلترة من سجل التفضيلات */
export function topRosyServiceFromPreferenceSignals(sig: UserPreferenceSignals): RosyServiceType | null {
  for (const c of sig.preferredCategories) {
    if (c === 'nails') return 'nails'
    if (c === 'hair') return 'hair'
    if (c === 'laser') return 'laser'
  }
  return null
}

export function buildRosyWelcomeFromSignals(sig: UserPreferenceSignals): string {
  const top = sig.preferredCategories[0]
  if (top === 'nails')
    return `بما إنك تحبين الأظافر 💅\nلقيت لك أفضل الخيارات 👇\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  if (top === 'hair')
    return `بما إنك تهتمين بالشعر 💇‍♀️\nخليني أوريكِ أحلى الخيارات ✨\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  if (top === 'spa')
    return `يبدو إنك تحبين السبا والعناية 💆‍♀️\nهذي أماكن تستحق التجربة 👇\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  if (top === 'laser')
    return `شايفة إنك تبحثين عن ليزر وعناية دقيقة ✨\nألقى لك الأنسب 👇\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  const loc = sig.preferredLocationHints[0]
  if (loc)
    return `أشوف إنك تفضلين منطقة ${loc} 📍\n${ROSY_BOOKING_ASSISTANT_TITLE}\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  return `${ROSY_BOOKING_ASSISTANT_TITLE}\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
}

/**
 * طبقة الذاكرة أولاً (آخر حجز / مفضلات)، ثم إشارات السلوك من user_preference.
 */
export function buildRosyWelcomeFromMemoryAndSignals(memory: RosyMemoryLayer, sig: UserPreferenceSignals): string {
  if (memory.lastBooking) {
    const { servicePhraseAr, emoji } = memory.lastBooking
    return `آخر مرة حجزتي ${servicePhraseAr} ${emoji}\nتبغي نفس الشي اليوم؟\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  }
  if (memory.favoriteSalons.length > 0) {
    const parts = memory.favoriteSalons.slice(0, 2).map((s) => s.name_ar)
    const tail = memory.favoriteSalons.length > 2 ? '…' : ''
    const names = `${parts.join('، ')}${tail}`
    return `أفتكر مفضلاتك 💕\n${names}\nنكمّل منهم ولا أدلّكِ على تجارب جديدة؟\n${ROSY_BOOKING_ASSISTANT_SUBTITLE}`
  }
  return buildRosyWelcomeFromSignals(sig)
}

export async function fetchRosyWelcomeContext(userId: string): Promise<{
  sig: UserPreferenceSignals
  memory: RosyMemoryLayer
}> {
  const [sig, memory] = await Promise.all([fetchUserPreferenceSignals(userId), fetchRosyMemoryLayer(userId)])
  return { sig, memory }
}

export async function buildRosyWelcomeMessage(userId: string): Promise<string> {
  const { sig, memory } = await fetchRosyWelcomeContext(userId)
  return buildRosyWelcomeFromMemoryAndSignals(memory, sig)
}

export async function fetchAiUserProfile(userId: string): Promise<AiUserProfile> {
  const [favRes, bookRes, prefSig] = await Promise.all([
    supabase.from('favorites').select('business_id').eq('user_id', userId),
    supabase.from('bookings').select('business_id').eq('user_id', userId),
    fetchUserPreferenceSignals(userId),
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

  const prefCats = prefSig.preferredCategories.length ? prefSig.preferredCategories : undefined
  const locHints = prefSig.preferredLocationHints.length ? prefSig.preferredLocationHints : undefined

  return {
    favoriteSalonIds,
    salonBookingCounts,
    bookedCategoryCounts,
    preferredCategories: prefCats,
    preferredPriceRange: prefSig.preferredPriceRange ?? undefined,
    preferredLocationHints: locHints,
  }
}

export type RecommendedSalon = RankedSalon<Business & { activeOffer?: SalonActiveOffer | null }>

export type RecommendSort = 'ai' | 'distance' | 'rating'

/** صف صالون مع مسافة (اقتراح روزي المحلي أو الترتيب الذكي) */
export type SalonWithRecommendMeta = Business & {
  activeOffer: SalonActiveOffer | null
  distance_km: number | null
  score?: number
  aiScore?: number
  isRecommended?: boolean
  subscription_plan?: SalonSubscriptionPlan | null
  has_active_featured_ad?: boolean | null
}

export async function fetchActiveSubscriptionPlansForSalonIds(
  salonIds: string[]
): Promise<Map<string, SalonSubscriptionPlan>> {
  const map = new Map<string, SalonSubscriptionPlan>()
  if (!isSupabaseConfigured || !salonIds.length) return map

  void supabase.rpc('expire_salon_subscriptions').then(
    () => {},
    () => {}
  )

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('salon_subscriptions')
    .select('salon_id, plan')
    .in('salon_id', salonIds)
    .eq('status', 'active')
    .gt('expires_at', now)

  if (error || !data?.length) return map

  const rank = (p: string) => (p === 'premium' ? 3 : p === 'pro' ? 2 : p === 'basic' ? 1 : 0)
  for (const row of data) {
    const sid = row.salon_id as string
    const plan = row.plan as string
    if (!isSalonSubscriptionPlan(plan)) continue
    const cur = map.get(sid)
    if (!cur || rank(plan) > rank(cur)) map.set(sid, plan)
  }
  return map
}

function attachDistanceKm<T extends Business & { activeOffer?: SalonActiveOffer | null }>(
  rows: T[],
  userLocation: { lat: number; lng: number } | null
): (T & { distance_km: number | null })[] {
  return rows.map((b) => {
    const la = Number(b.latitude)
    const ln = Number(b.longitude)
    let distance_km: number | null = null
    if (userLocation && Number.isFinite(la) && Number.isFinite(ln)) {
      distance_km = haversineKm(userLocation.lat, userLocation.lng, la, ln)
    }
    return { ...b, distance_km }
  })
}

function partitionFeaturedAdsFirst<T extends { has_active_featured_ad?: boolean | null }>(rows: T[]): T[] {
  const withAd = rows.filter((r) => r.has_active_featured_ad)
  const rest = rows.filter((r) => !r.has_active_featured_ad)
  return [...withAd, ...rest]
}

export async function getRecommendedSalons(
  userId: string | null | undefined,
  options?: {
    limit?: number
    poolLimit?: number
    preferredCategories?: PreferredCategory[]
    sort?: RecommendSort
    userLocation?: { lat: number; lng: number } | null
    serviceType?: RosyServiceType | null
  }
): Promise<SalonWithRecommendMeta[]> {
  const limit = options?.limit ?? 12
  const poolLimit = options?.poolLimit ?? 220
  let sortMode: RecommendSort = options?.sort ?? 'ai'
  const userLocation = options?.userLocation ?? null
  const serviceType = options?.serviceType ?? null

  if (sortMode === 'distance' && !userLocation) {
    sortMode = 'rating'
  }

  if (!isSupabaseConfigured) return []

  void supabase.rpc('expire_salon_subscriptions').then(
    () => {},
    () => {}
  )

  const { data: pool, error: poolErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(poolLimit)

  if (poolErr || !pool?.length) return []

  let businesses = pool as Business[]
  if (serviceType) {
    businesses = businesses.filter((b) => businessMatchesServiceType(b, serviceType))
  }
  if (businesses.length === 0) return []

  const [offerMap, planMap, adSet] = await Promise.all([
    fetchBestActiveOffersByBusinessIds(businesses.map((b) => b.id)),
    fetchActiveSubscriptionPlansForSalonIds(businesses.map((b) => b.id)),
    fetchActiveSalonFeaturedAdSalonIds(businesses.map((b) => b.id)),
  ])
  const withOffers = businesses.map((b) => ({
    ...b,
    activeOffer: offerMap.get(b.id) ?? null,
    subscription_plan: planMap.get(b.id) ?? null,
    has_active_featured_ad: adSet.has(b.id),
  }))

  if (sortMode === 'rating') {
    const rows = attachDistanceKm(withOffers, userLocation)
    rows.sort((a, b) => {
      const ra = typeof a.average_rating === 'number' && Number.isFinite(a.average_rating) ? a.average_rating : 0
      const rb = typeof b.average_rating === 'number' && Number.isFinite(b.average_rating) ? b.average_rating : 0
      if (rb !== ra) return rb - ra
      const rev = (b.total_reviews ?? 0) - (a.total_reviews ?? 0)
      if (rev !== 0) return rev
      const pt =
        subscriptionPlanTier(b.subscription_plan ?? null) - subscriptionPlanTier(a.subscription_plan ?? null)
      if (pt !== 0) return pt
      const feat = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
      if (feat !== 0) return feat
      return (b.has_active_featured_ad ? 1 : 0) - (a.has_active_featured_ad ? 1 : 0)
    })
    return partitionFeaturedAdsFirst(rows).slice(0, limit) as SalonWithRecommendMeta[]
  }

  if (sortMode === 'distance' && userLocation) {
    const rows = attachDistanceKm(withOffers, userLocation)
    const withDist = rows.filter((x) => x.distance_km != null) as Array<
      (typeof rows)[number] & { distance_km: number }
    >
    withDist.sort((a, b) => {
      const d = a.distance_km - b.distance_km
      if (Math.abs(d) > 1e-6) return d
      const pt =
        subscriptionPlanTier(b.subscription_plan ?? null) - subscriptionPlanTier(a.subscription_plan ?? null)
      if (pt !== 0) return pt
      const feat = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
      if (feat !== 0) return feat
      return (b.has_active_featured_ad ? 1 : 0) - (a.has_active_featured_ad ? 1 : 0)
    })

    const head = partitionFeaturedAdsFirst(withDist)
    if (head.length >= limit) {
      return head.slice(0, limit) as SalonWithRecommendMeta[]
    }
    const ids = new Set(head.map((x) => x.id))
    const rest = rows
      .filter((x) => !ids.has(x.id))
      .sort((a, b) => {
        const ra = typeof a.average_rating === 'number' && Number.isFinite(a.average_rating) ? a.average_rating : 0
        const rb = typeof b.average_rating === 'number' && Number.isFinite(b.average_rating) ? b.average_rating : 0
        if (rb !== ra) return rb - ra
        const rev = (b.total_reviews ?? 0) - (a.total_reviews ?? 0)
        if (rev !== 0) return rev
        const pt =
          subscriptionPlanTier(b.subscription_plan ?? null) - subscriptionPlanTier(a.subscription_plan ?? null)
        if (pt !== 0) return pt
        const feat = (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
        if (feat !== 0) return feat
        return (b.has_active_featured_ad ? 1 : 0) - (a.has_active_featured_ad ? 1 : 0)
      })
    return [...head, ...partitionFeaturedAdsFirst(rest)].slice(0, limit) as SalonWithRecommendMeta[]
  }

  const extraServicePrefs: PreferredCategory[] = []
  if (serviceType === 'hair') extraServicePrefs.push('hair')
  if (serviceType === 'nails') extraServicePrefs.push('nails')
  if (serviceType === 'laser') extraServicePrefs.push('laser')

  let userProfile: AiUserProfile | undefined
  if (userId) {
    const base = await fetchAiUserProfile(userId)
    const mergedPrefs = [
      ...(options?.preferredCategories ?? []),
      ...(base.preferredCategories ?? []),
      ...extraServicePrefs,
    ]
    const uniquePrefs = [...new Set(mergedPrefs)]
    userProfile = {
      ...base,
      preferredCategories: uniquePrefs.length ? uniquePrefs : base.preferredCategories,
    }
  } else if (options?.preferredCategories?.length || extraServicePrefs.length) {
    userProfile = {
      preferredCategories: [...new Set([...(options?.preferredCategories ?? []), ...extraServicePrefs])],
    }
  }

  const ranked = rankSalons(withOffers, userProfile)
  const sliced = partitionFeaturedAdsFirst(ranked).slice(0, limit)
  return attachDistanceKm(sliced, userLocation) as SalonWithRecommendMeta[]
}
