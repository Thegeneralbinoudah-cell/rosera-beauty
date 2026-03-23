import { supabase } from '@/lib/supabase'
import { fetchBoostContext } from '@/lib/boosts'
import {
  type UserRecommendationHistory,
  type ServiceForRank,
  type ProductForRank,
  type ScoredItem,
  skinTokensFromPayload,
  rankServices,
  rankProducts,
} from '@/lib/ranking'

/** Parsed JSON from Edge skin-analysis / stored in analysis_result */
export type SkinAnalysisResultPayload = {
  skin_type?: string
  concerns?: string[]
  severity?: string
  recommended_treatments?: string[]
  recommended_services?: string[]
  notes_ar?: string
}

export type UserSkinProfile = {
  id: string
  user_id: string
  image_url: string | null
  created_at: string
  skin_type: string | null
  issues: string[] | null
  hydration_level: number | null
  recommendations: string[] | null
  analysis_result: SkinAnalysisResultPayload | null
}

const EVENT_HALFLIFE_DAYS = 14

function decayFactor(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / EVENT_HALFLIFE_DAYS)
}

function bumpEventScore(map: Map<string, number>, id: string, delta: number) {
  if (!id) return
  map.set(id, (map.get(id) ?? 0) + delta)
}

export function emptyUserRecommendationHistory(): UserRecommendationHistory {
  return {
    bookedServiceIds: new Set(),
    bookedBusinessIds: new Set(),
    orderedProductIds: new Set(),
    favoriteBusinessIds: new Set(),
    serviceEventScore: new Map(),
    productEventScore: new Map(),
    businessEventScore: new Map(),
  }
}

/**
 * Bookings, orders, favorites, and decayed user_events → maps/sets for ranking.
 * "Ignore" is implicit: older events decay (half-life ~14d) unless reinforced.
 */
export async function fetchUserRecommendationHistory(userId: string): Promise<UserRecommendationHistory> {
  const h = emptyUserRecommendationHistory()

  const [bookingsRes, favRes, itemsRes, eventsRes] = await Promise.all([
    supabase.from('bookings').select('business_id, service_id, service_ids').eq('user_id', userId),
    supabase.from('favorites').select('business_id').eq('user_id', userId),
    supabase
      .from('order_items')
      .select('product_id, orders!inner(user_id)')
      .eq('orders.user_id', userId),
    supabase
      .from('user_events')
      .select('event_type, entity_type, entity_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(400),
  ])

  for (const row of bookingsRes.data ?? []) {
    const b = row as { business_id?: string; service_id?: string | null; service_ids?: string[] | null }
    if (b.business_id) h.bookedBusinessIds.add(b.business_id)
    if (b.service_id) h.bookedServiceIds.add(b.service_id)
    for (const sid of b.service_ids || []) {
      if (sid) h.bookedServiceIds.add(sid)
    }
  }

  for (const row of favRes.data ?? []) {
    const bid = (row as { business_id?: string }).business_id
    if (bid) h.favoriteBusinessIds.add(bid)
  }

  for (const row of itemsRes.data ?? []) {
    const pid = (row as { product_id?: string | null }).product_id
    if (pid) h.orderedProductIds.add(pid)
  }

  for (const row of eventsRes.data ?? []) {
    const r = row as { event_type: string; entity_type: string; entity_id: string; created_at: string }
    const d = decayFactor(r.created_at)
    const w = r.event_type === 'book' ? 1.15 : r.event_type === 'click' ? 0.5 : 0.15
    const add = w * d
    if (r.entity_type === 'service') bumpEventScore(h.serviceEventScore, r.entity_id, add)
    else if (r.entity_type === 'product') bumpEventScore(h.productEventScore, r.entity_id, add)
    else if (r.entity_type === 'business') bumpEventScore(h.businessEventScore, r.entity_id, add)
  }

  return h
}

/** Latest saved skin analysis for the user (RLS: own rows). */
export async function getUserSkinProfile(userId: string): Promise<UserSkinProfile | null> {
  const { data, error } = await supabase
    .from('skin_analysis')
    .select('id,user_id,image_url,created_at,skin_type,issues,hydration_level,recommendations,analysis_result')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const row = data as UserSkinProfile
  if (row.analysis_result && typeof row.analysis_result === 'object') return row
  return row
}

/**
 * Rank active services (multi-signal): skin, category hints, salon popularity, behavior.
 */
export async function getRecommendedServices(
  profile: UserSkinProfile | null,
  userId: string | null | undefined,
  limit = 12
): Promise<ScoredItem<ServiceForRank>[]> {
  const skinPayload = profile?.analysis_result ?? null
  const tokens = skinTokensFromPayload(skinPayload)
  const history = userId ? await fetchUserRecommendationHistory(userId) : emptyUserRecommendationHistory()
  const boost = await fetchBoostContext()

  const { data, error } = await supabase
    .from('services')
    .select('*, businesses ( total_bookings, average_rating, total_reviews )')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(150)

  if (error || !data?.length) return []
  const list = data as ServiceForRank[]
  return rankServices(list, skinPayload, tokens, history, limit, boost)
}

/**
 * Rank store products with the same signal blend (popularity from rating/reviews).
 */
export async function getRecommendedProducts(
  profile: UserSkinProfile | null,
  userId: string | null | undefined,
  limit = 12
): Promise<ScoredItem<ProductForRank>[]> {
  const skinPayload = profile?.analysis_result ?? null
  const tokens = skinTokensFromPayload(skinPayload)
  const history = userId ? await fetchUserRecommendationHistory(userId) : emptyUserRecommendationHistory()
  const boost = await fetchBoostContext()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(150)

  if (error || !data?.length) return []
  const list = data as ProductForRank[]
  return rankProducts(list, skinPayload, tokens, history, limit, boost)
}

/** Build search screen query from vision result. */
export function getSkinSearchParamsFromResult(r: SkinAnalysisResultPayload | null): { q: string; categoryLabel: string } {
  const services = r?.recommended_services || []
  const treat = r?.recommended_treatments || []
  const raw = [...services, ...treat].join(' ').trim()
  const q = raw.slice(0, 120) || 'عناية بالبشرة'
  return { q, categoryLabel: 'عناية بالبشرة' }
}

export type { ScoredItem, ServiceForRank, ProductForRank }
