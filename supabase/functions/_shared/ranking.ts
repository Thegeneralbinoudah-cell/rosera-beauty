/**
 * Mirror of src/lib/ranking.ts — keep weights and copy in sync when tuning.
 * Deno edge cannot import Vite path aliases from the app bundle.
 */
type Service = {
  id: string
  business_id: string
  name_ar: string
  category?: string | null
  price: number
  duration_minutes: number
}

type Product = {
  id: string
  name_ar: string
  brand_ar?: string
  description_ar?: string
  category: string
  price: number
  rating?: number
  review_count?: number
  image_url?: string | null
}

export type SkinPayloadForRank = {
  skin_type?: string
  concerns?: string[]
  recommended_treatments?: string[]
  recommended_services?: string[]
}

export type UserRecommendationHistory = {
  bookedServiceIds: Set<string>
  bookedBusinessIds: Set<string>
  orderedProductIds: Set<string>
  favoriteBusinessIds: Set<string>
  serviceEventScore: Map<string, number>
  productEventScore: Map<string, number>
  businessEventScore: Map<string, number>
}

export type ServiceForRank = Service & {
  businesses?: {
    total_bookings?: number | null
    average_rating?: number | null
    total_reviews?: number | null
  } | null
}

export type ProductForRank = Product

export type RankScore = {
  score: number
  reasons: string[]
}

export type ScoredItem<T> = {
  item: T
  score: number
  reasons: string[]
  sponsored?: boolean
  sponsorLabel?: 'featured' | 'priority'
}

export type BoostMeta = {
  pct: number
  boost_type: 'featured' | 'priority'
}

export type BoostContext = {
  businessBoost: Map<string, BoostMeta>
  productBoost: Map<string, BoostMeta>
}

const W_SKIN = 0.4
const W_CAT = 0.2
const W_POP = 0.2
const W_BEH = 0.2
const MAX_SPONSORED_POINTS = 6

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function sponsoredDelta(baseScore: number, meta: BoostMeta | undefined): number {
  if (!meta || meta.pct <= 0) return 0
  return Math.min(MAX_SPONSORED_POINTS, (baseScore * meta.pct) / 100)
}

function attachSponsored(
  baseScore: number,
  reasons: string[],
  meta: BoostMeta | undefined
): { score: number; reasons: string[]; sponsored?: boolean; sponsorLabel?: 'featured' | 'priority' } {
  const add = sponsoredDelta(baseScore, meta)
  if (add <= 0) return { score: baseScore, reasons, sponsored: false }
  const score = Math.round((baseScore + add) * 10) / 10
  const tag = meta?.boost_type === 'featured' ? 'Featured' : 'مُموَّل'
  const next = [...reasons]
  if (!next.some((r) => r.includes('مُموَّل') || r.includes('Featured'))) {
    next.push(`${tag} · دعم ظهور في الترتيب`)
  }
  return {
    score,
    reasons: next.slice(0, 5),
    sponsored: true,
    sponsorLabel: meta?.boost_type === 'featured' ? 'featured' : 'priority',
  }
}

export function skinTokensFromPayload(r: SkinPayloadForRank | null): string[] {
  if (!r) return []
  const parts: string[] = []
  if (r.skin_type) parts.push(r.skin_type)
  for (const c of r.concerns || []) if (c) parts.push(String(c))
  for (const t of r.recommended_treatments || []) if (t) parts.push(String(t))
  for (const s of r.recommended_services || []) if (s) parts.push(String(s))
  return [...new Set(parts.map((x) => x.trim()).filter(Boolean))]
}

function haystackService(s: ServiceForRank): string {
  return `${s.name_ar} ${s.category || ''}`.toLowerCase()
}

function skinMatchScore(tokens: string[], hay: string): { v: number; hits: string[] } {
  if (!tokens.length) return { v: 0.35, hits: [] }
  const hits: string[] = []
  let raw = 0
  for (const t of tokens) {
    const tl = t.toLowerCase()
    if (tl.length < 2) continue
    if (hay.includes(tl)) {
      raw += tl.length >= 5 ? 0.28 : 0.18
      if (hits.length < 4 && !hits.includes(t)) hits.push(t)
    }
  }
  return { v: clamp01(raw), hits }
}

function categoryRelevance(skin: SkinPayloadForRank | null, hay: string): { v: number; note?: string } {
  if (!skin) return { v: 0.25 }
  const hints = [...(skin.recommended_services || []), ...(skin.recommended_treatments || [])]
  if (!hints.length) return { v: 0.25 }
  let best = 0
  for (const h of hints) {
    const hl = h.toLowerCase()
    if (hl.length > 1 && hay.includes(hl)) best = Math.max(best, 0.85)
    else if (hl.length > 3) {
      const parts = hl.split(/\s+/)
      for (const p of parts) {
        if (p.length > 2 && hay.includes(p)) best = Math.max(best, 0.45)
      }
    }
  }
  return { v: clamp01(best + 0.15), note: best >= 0.45 ? 'قريب من الخدمات المقترحة لبشرتكِ' : undefined }
}

function popularityService(biz: ServiceForRank['businesses']): { v: number; note?: string } {
  const rating = Number(biz?.average_rating ?? 0)
  const bookings = Number(biz?.total_bookings ?? 0)
  const reviews = Number(biz?.total_reviews ?? 0)
  const rNorm = clamp01(rating / 5)
  const bNorm = clamp01(Math.log(1 + bookings) / Math.log(201))
  const revNorm = clamp01(Math.log(1 + reviews) / Math.log(501))
  const v = clamp01(0.45 * rNorm + 0.4 * bNorm + 0.15 * revNorm)
  const note =
    rNorm >= 0.72 && bNorm >= 0.25
      ? 'تقييم عالي وشائع في الحجوزات'
      : rNorm >= 0.72
        ? 'تقييم مرتفع لدى العميلات'
        : bNorm >= 0.35
          ? 'صالون نشيط بالحجوزات'
          : undefined
  return { v, note }
}

function behaviorService(s: ServiceForRank, h: UserRecommendationHistory): { v: number; notes: string[] } {
  const notes: string[] = []
  if (h.bookedServiceIds.has(s.id)) {
    return { v: 1, notes: ['سبق وحجزتِ خدمة مشابهة أو من نفس الصالون'] }
  }
  let v = 0
  if (h.bookedBusinessIds.has(s.business_id)) {
    v += 0.55
    notes.push('حجزتِ سابقاً في هذا الصالون')
  }
  if (h.favoriteBusinessIds.has(s.business_id)) {
    v += 0.4
    notes.push('الصالون في مفضلتكِ')
  }
  v += clamp01((h.serviceEventScore.get(s.id) ?? 0) / 4)
  v += clamp01((h.businessEventScore.get(s.business_id) ?? 0) / 5) * 0.6
  if ((h.serviceEventScore.get(s.id) ?? 0) > 0.3 && !notes.some((x) => x.includes('تفاعل')))
    notes.push('تفاعلتِ مؤخراً مع خدمات مشابهة')
  return { v: clamp01(v), notes: notes.slice(0, 3) }
}

export function scoreService(
  service: ServiceForRank,
  skinPayload: SkinPayloadForRank | null,
  tokens: string[],
  history: UserRecommendationHistory
): RankScore {
  const hay = haystackService(service)
  const { v: skinV, hits } = skinMatchScore(tokens, hay)
  const { v: catV, note: catNote } = categoryRelevance(skinPayload, hay)
  const { v: popV, note: popNote } = popularityService(service.businesses)
  const { v: behV, notes: behNotes } = behaviorService(service, history)

  const score =
    100 *
    (W_SKIN * skinV + W_CAT * catV + W_POP * popV + W_BEH * (0.35 + 0.65 * behV))

  const reasons: string[] = []
  if (tokens.length && skinV >= 0.22) {
    reasons.push(
      hits.length
        ? `يتوافق مع تحليل بشرتكِ (${hits.slice(0, 2).join('، ')})`
        : 'يتوافق مع تحليل بشرتكِ'
    )
  }
  if (catNote) reasons.push(catNote)
  if (popNote) reasons.push(popNote)
  for (const n of behNotes) if (n && !reasons.includes(n)) reasons.push(n)
  if (!reasons.length) reasons.push('خيار مناسب ضمن شبكة روزيرا')

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) }
}

function haystackProduct(p: ProductForRank): string {
  return `${p.name_ar} ${p.description_ar || ''} ${p.category} ${p.brand_ar || ''}`.toLowerCase()
}

function popularityProduct(p: ProductForRank): { v: number; note?: string } {
  const rating = Number(p.rating ?? 0)
  const rc = Number(p.review_count ?? 0)
  const rNorm = clamp01(rating / 5)
  const cNorm = clamp01(Math.log(1 + rc) / Math.log(401))
  const v = clamp01(0.55 * rNorm + 0.45 * cNorm)
  const note = rNorm >= 0.7 && cNorm >= 0.2 ? 'منتج بتقييم ومراجعات قوية' : rNorm >= 0.75 ? 'تقييم مرتفع' : undefined
  return { v, note }
}

function behaviorProduct(p: ProductForRank, h: UserRecommendationHistory): { v: number; notes: string[] } {
  const notes: string[] = []
  if (h.orderedProductIds.has(p.id)) {
    return { v: 1, notes: ['اشتريتِ هذا المنتج أو مشابهاً من المتجر سابقاً'] }
  }
  let v = clamp01((h.productEventScore.get(p.id) ?? 0) / 4)
  if (v > 0.2) notes.push('تصفحتِ منتجات عناية مشابهة')
  return { v, notes }
}

export function scoreProduct(
  product: ProductForRank,
  skinPayload: SkinPayloadForRank | null,
  tokens: string[],
  history: UserRecommendationHistory
): RankScore {
  const hay = haystackProduct(product)
  const { v: skinV, hits } = skinMatchScore(tokens, hay)
  const { v: catV, note: catNote } = categoryRelevance(skinPayload, hay)
  const { v: popV, note: popNote } = popularityProduct(product)
  const { v: behV, notes: behNotes } = behaviorProduct(product, history)

  const score =
    100 *
    (W_SKIN * skinV + W_CAT * catV + W_POP * popV + W_BEH * (0.35 + 0.65 * behV))

  const reasons: string[] = []
  if (tokens.length && skinV >= 0.22) {
    reasons.push(hits.length ? `يناسب اهتمامات بشرتكِ (${hits.slice(0, 2).join('، ')})` : 'يناسب اهتمامات بشرتكِ')
  }
  if (catNote) reasons.push(catNote.replace('خدمات', 'تصنيف المنتج'))
  if (popNote) reasons.push(popNote)
  for (const n of behNotes) if (n && !reasons.includes(n)) reasons.push(n)
  if (!reasons.length) reasons.push('منتج مميز من متجر روزيرا')

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) }
}

export function rankServices(
  list: ServiceForRank[],
  skinPayload: SkinPayloadForRank | null,
  tokens: string[],
  history: UserRecommendationHistory,
  limit: number,
  boost?: BoostContext | null
): ScoredItem<ServiceForRank>[] {
  const scored = list.map((item) => {
    const { score: base, reasons } = scoreService(item, skinPayload, tokens, history)
    const meta = boost?.businessBoost.get(item.business_id)
    const extra = attachSponsored(base, reasons, meta)
    return {
      item,
      score: extra.score,
      reasons: extra.reasons,
      sponsored: extra.sponsored,
      sponsorLabel: extra.sponsorLabel,
    }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

export function rankProducts(
  list: ProductForRank[],
  skinPayload: SkinPayloadForRank | null,
  tokens: string[],
  history: UserRecommendationHistory,
  limit: number,
  boost?: BoostContext | null
): ScoredItem<ProductForRank>[] {
  const scored = list.map((item) => {
    const { score: base, reasons } = scoreProduct(item, skinPayload, tokens, history)
    const meta = boost?.productBoost.get(item.id)
    const extra = attachSponsored(base, reasons, meta)
    return {
      item,
      score: extra.score,
      reasons: extra.reasons,
      sponsored: extra.sponsored,
      sponsorLabel: extra.sponsorLabel,
    }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
