import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  rankProducts,
  rankServices,
  skinTokensFromPayload,
  type ProductForRank,
  type ScoredItem,
  type ServiceForRank,
  type SkinPayloadForRank,
  type UserRecommendationHistory,
} from '../_shared/ranking.ts'
import {
  getProductsByCategory,
  inferPrimaryStoreCategory,
} from '../_shared/roseyStoreProducts.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Matches client `FEATURED_AD_AI_RANK_BOOST` in aiRanking / salonAds. */
const FEATURED_AD_RANK_BOOST = 58

const OPENAI_MODEL = 'gpt-4o'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

type IntentName =
  | 'search_salon'
  | 'recommend_service'
  | 'booking_request'
  | 'store_products'
  | 'general_question'

type ClassifyResult = {
  intent: IntentName
  entities: Record<string, unknown>
}

type BookingExtract = {
  salon_id: string | null
  service_id: string | null
  booking_date: string | null
}

type SalonRow = {
  id: string
  name_ar: string
  city: string
  city_id: string | null
  category: string | null
  category_label: string | null
  average_rating: number | null
  address_ar: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
  latitude?: number | null
  longitude?: number | null
  total_bookings?: number | null
  cover_image?: string | null
  google_photo_resource?: string | null
  price_range?: string | null
  is_featured?: boolean | null
  rosy_pricing_flexible?: boolean | null
  rosy_discount_allowed?: boolean | null
  rosy_max_discount_percent?: number | null
  /** Active B2B subscription plan (joined after fetch) */
  subscription_plan?: 'basic' | 'pro' | 'premium' | null
  /** Paid featured ad (salon_ads) in date window — set after fetch */
  has_active_featured_ad?: boolean
}

type RozySalonOut = {
  id: string
  name_ar: string
  average_rating: number | null
  distance_km: number | null
  cover_image: string | null
  google_photo_resource: string | null
}

type RozyActionOut = {
  id: string
  label: string
  salon_id?: string | null
  kind?: string
  service_id?: string | null
  discount_percent?: number | null
  product_id?: string | null
  product_name_ar?: string | null
  product_price?: number | null
  product_image_url?: string | null
  product_brand_ar?: string | null
}

/** بطاقات منتجات للواجهة — تطابق `RozyProductCard` في العميل */
type RozyProductOut = {
  id: string
  name_ar: string
  price: number
  benefit: string
  image_url: string | null
  brand_ar: string | null
  category: string | null
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const STORE_CATEGORY_AR = [
  'عناية بالبشرة',
  'مكياج',
  'عناية بالشعر',
  'عطور',
  'أظافر',
  'أجهزة تجميل',
  'سبا',
  'عناية بالجسم',
] as const

const VALID_STORE_CATS = new Set<string>(STORE_CATEGORY_AR)

function utteranceSalonHeavy(utterance: string): boolean {
  return /صالون|حجز|موعد|احجز|أحجز|احجزي|أقرب\s*صالون|دلّيني\s*صالون|دليني\s*صالون|موعد\s*في/i.test(utterance)
}

/** استنتاج فئات المتجر من نص المستخدم — يطابق أعمدة `products.category` */
function inferStoreCategoriesFromUtterance(utterance: string): string[] {
  const s = new Set<string>()
  if (/بشرتك|بشرتي|جاف|جافة|جفاف|ترطيب|ريتينول|حمض|سيروم|كريم|بشرة|مسام|حبوب|نضارة|حساس|تهيج|واقي\s*شمس|spf|نياسيناميد/i.test(utterance)) {
    s.add('عناية بالبشرة')
  }
  if (/ماسك|قناع|قناع\s*طين|تقشير\s*بشرة|ماسكات/i.test(utterance)) {
    s.add('عناية بالبشرة')
    s.add('سبا')
  }
  if (/شامبو|شعر|فروة|تساقط|بروتين|كيراتين|زيت\s*شعر|تموج|كيرلي|صبغ|أطراف/i.test(utterance)) s.add('عناية بالشعر')
  if (/عطر|عطور|ماء\s*عطر|بارفان|perfume/i.test(utterance)) s.add('عطور')
  if (/أظافر|اظافر|طلاء|مانيكير|بديكير|جيل\s*أظافر/i.test(utterance)) s.add('أظافر')
  if (/مكياج|أحمر\s*شفاه|فاونديشن|كونسيلر|آيلاينر|ماسكارا|باليت|هايلايتر/i.test(utterance)) s.add('مكياج')
  if (/دايسون|سيراميك|ليزر\s*منزل|فوريو|جهاز\s*تجميل|styler|مكواة\s*شعر|أداة\s*تصفيف|آي\s*بي\s*إل/i.test(utterance)) {
    s.add('أجهزة تجميل')
  }
  if (/سبا|استحمام|ملح\s*استحمام|حمام\s*زيت|شمعة|تدليك|bath/i.test(utterance)) s.add('سبا')
  if (/جسم|لوشن|بودرة|مزيل\s*عرق|كريم\s*جسم|صابون\s*جسم|زيت\s*جسم/i.test(utterance)) s.add('عناية بالجسم')
  return [...s]
}

function normalizeStoreCategoriesFromEntities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const t = x.trim()
    if (VALID_STORE_CATS.has(t)) out.push(t)
  }
  return [...new Set(out)]
}

function resolveStoreCategories(entities: Record<string, unknown>, utterance: string, intent: IntentName): string[] {
  const fromAi = normalizeStoreCategoriesFromEntities(entities.store_categories)
  const inferred = inferStoreCategoriesFromUtterance(utterance)
  const merged = new Set([...fromAi, ...inferred])
  let list = [...merged]
  if (intent === 'store_products' && list.length === 0) list = inferred
  return list
}

/** فئة متجر واحدة: تصنيف المصنّف ثم استنتاج من النص (خريطة STEP 2). */
function pickPrimaryStoreCategory(entities: Record<string, unknown>, utterance: string): string | null {
  const fromAi = normalizeStoreCategoriesFromEntities(entities.store_categories)
  if (fromAi.length) return fromAi[0]
  return inferPrimaryStoreCategory(utterance)
}

function shortenBenefit(desc: string | null | undefined): string {
  const t = (desc ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return 'منتج من متجر روزيرا.'
  return t.length > 110 ? `${t.slice(0, 107)}…` : t
}

function mapRankedProductsToRozyOut(ranked: ScoredItem<ProductForRank>[]): RozyProductOut[] {
  return ranked.map((x) => ({
    id: x.item.id,
    name_ar: x.item.name_ar,
    price: Math.round(Number(x.item.price ?? 0) * 100) / 100,
    benefit: shortenBenefit(x.item.description_ar),
    image_url: (x.item as { image_url?: string | null }).image_url ?? null,
    brand_ar: x.item.brand_ar ? String(x.item.brand_ar) : null,
    category: x.item.category ?? null,
  }))
}

/** لا يوجد store_categories من المصنّف → نية أضعف → أقل منتجات لتقليل الإرباك. */
function isUncertainStoreIntent(entities: Record<string, unknown>): boolean {
  return normalizeStoreCategoriesFromEntities(entities.store_categories).length === 0
}

/**
 * بعد الترتيب الذكي: خيار بسعر أعلى (premium) + خيار بسعر متوسط (متوازن) + (إن وُجد ثالث) الأكثر مبيعاً حسب المراجعات.
 */
function diversifyCommercePicks(scored: ScoredItem<ProductForRank>[], limit: number): ScoredItem<ProductForRank>[] {
  if (scored.length === 0) return []
  if (scored.length <= limit) return scored.slice(0, limit)
  const items = scored.map((s) => s.item)
  const scoreMap = new Map(scored.map((s) => [s.item.id, s]))
  const num = (x: unknown) => Number(x ?? 0)
  const byPriceDesc = [...items].sort((a, b) => num(b.price) - num(a.price))
  const byRatingDesc = [...items].sort((a, b) => num(b.rating) - num(a.rating))
  const byReviewsDesc = [...items].sort((a, b) => num(b.review_count) - num(a.review_count))

  const premium = byPriceDesc[0]
  const balanced =
    byPriceDesc[Math.floor(byPriceDesc.length / 2)] ?? byRatingDesc[Math.min(1, byRatingDesc.length - 1)]

  const pickOrder: ProductForRank[] = []
  const add = (p: ProductForRank | undefined) => {
    if (!p || pickOrder.some((x) => x.id === p.id)) return
    pickOrder.push(p)
  }

  add(premium)
  add(balanced)
  if (limit >= 3) {
    const bestSelling =
      byReviewsDesc.find((p) => !pickOrder.some((x) => x.id === p.id)) ??
      byRatingDesc.find((p) => !pickOrder.some((x) => x.id === p.id))
    add(bestSelling)
  }
  for (const s of scored) {
    if (pickOrder.length >= limit) break
    add(s.item)
  }

  return pickOrder.slice(0, limit).map((item) => scoreMap.get(item.id)!)
}

async function fetchProductsForStoreRecommendations(
  sb: SupabaseClient,
  entities: Record<string, unknown>,
  utterance: string,
  intent: IntentName,
  skinPayload: SkinPayloadForRank | null,
  reco: UserRecommendationHistory,
  max = 3
): Promise<RozyProductOut[]> {
  const poolSize = 12
  const primary = pickPrimaryStoreCategory(entities, utterance)
  if (primary) {
    const rows = await getProductsByCategory(sb, primary, poolSize)
    if (rows.length) {
      const asRank = rows as unknown as ProductForRank[]
      const tokens = skinTokensFromPayload(skinPayload)
      const ranked = rankProducts(asRank, skinPayload, tokens, reco, Math.min(24, asRank.length))
      const diversified = diversifyCommercePicks(ranked, max)
      return mapRankedProductsToRozyOut(diversified)
    }
  }

  const categories = resolveStoreCategories(entities, utterance, intent)
  if (categories.length === 0) return []
  const { data, error } = await sb
    .from('products')
    .select('id,name_ar,brand_ar,description_ar,category,image_url,price,rating,review_count')
    .eq('is_active', true)
    .eq('is_demo', false)
    .in('category', categories)
    .limit(48)
  if (error) {
    console.warn('[rozi-chat] fetchProductsForStoreRecommendations fallback', error.message)
    return []
  }
  const rows = (data ?? []) as ProductForRank[]
  if (rows.length === 0) return []
  const tokens = skinTokensFromPayload(skinPayload)
  const ranked = rankProducts(rows, skinPayload, tokens, reco, Math.min(24, rows.length))
  const diversified = diversifyCommercePicks(ranked, max)
  return mapRankedProductsToRozyOut(diversified)
}

function buildStoreProductBrainBlock(
  picks: RozyProductOut[],
  skinPayload: SkinPayloadForRank | null,
  memoryNarrative: string,
  slotCap: 2 | 3
): string {
  if (picks.length === 0) return ''
  const lines = picks.map(
    (p) =>
      `- [${p.id}] **${p.name_ar}**${p.brand_ar ? ` (${p.brand_ar})` : ''} — **${p.price.toFixed(0)} ر.س**${p.benefit ? ` — ${p.benefit}` : ''}`
  )
  const skinHint =
    skinPayload && (skinPayload.skin_type || (skinPayload.concerns && skinPayload.concerns.length > 0))
      ? `- نوع/اهتمام البشرة من السياق: ${skinPayload.skin_type ?? 'غير محدد'}${skinPayload.concerns?.length ? ` — اهتمامات: ${skinPayload.concerns.join('، ')}` : ''}`
      : ''
  const prefHint = memoryNarrative.trim()
    ? `- تفضيلات وذاكرة المحادثة (استخدميها بلطف دون إطالة): ${memoryNarrative.slice(0, 400)}${memoryNarrative.length > 400 ? '…' : ''}`
    : ''
  const contextExtras = [skinHint, prefHint].filter(Boolean).join('\n')
  const countHint = slotCap === 2 ? '**منتجان فقط** (نية غير واضحة من المصنّف)' : 'حتى **3** منتجات'

  return `## منتجات متجر روزيرا (مُختارة — استخدميها في الرد)
${lines.join('\n')}
${contextExtras ? `${contextExtras}\n` : ''}
- الترتيب يميل لأعلى تقييم وشعبية؛ جرّبي **نبرة الأكثر مبيعاً** بلطف عند أحد المنتجين إن لزم.
- افتتحي بسطر يبرّر للمستخدم (مثال): **"هلا والله ✨ بشرتك تحتاج ترطيب قوي، أنصحك بهذي:"** — خصّصي حسب سياق البشرة أعلاه إن وُجد.
- ثم قائمة بنفس النمط (${countHint} من الجدول):
  - [اسم المنتج] — [السعر] ر.س
- **عبارة إلحاح واحدة فقط** عندما يكون المنتج قوياً في التقييم/المراجعات في البيانات — **مرة واحدة في كل الرد** ولا تكرّريها: **"هذا من الأكثر طلباً 🔥"** — لا تضيفي غيرها من عبارات الاستعجال.
- **بعد القائمة مباشرة** أضيفي سطرين ثابتين (سيُكمَلان برمجياً إن نسيتِ): **"إذا تبين، أختار لك الأفضل بينهم ✨"** ثم **"تبين أضيف لك المنتج للسلة؟ 🛍️"**
- أزرار الواجهة: عرض المنتج + أضف للسلة — شجّعي على التجربة بلطف دون ضغط.
- روابط: /store و /product/{id}.
`
}

function appendProductConversionLines(reply: string): string {
  let t = reply.trim()
  if (!t) return 'إذا تبين، أختار لك الأفضل بينهم ✨\n\nتبين أضيف لك المنتج للسلة؟ 🛍️'
  if (!/أختار\s*لك\s*الأفضل\s*بينهم/i.test(t)) {
    t = `${t}\n\nإذا تبين، أختار لك الأفضل بينهم ✨`
  }
  if (!/تبين\s*أضيف\s*لك/i.test(t)) {
    t = `${t}\n\nتبين أضيف لك المنتج للسلة؟ 🛍️`
  }
  return t
}

function cartSummaryPhrase(cartLineCount: number): string {
  if (cartLineCount <= 0) return ''
  return cartLineCount === 1
    ? 'سلتك فيها منتج واحد 🛍️'
    : `سلتك فيها ${cartLineCount} منتجات 🛍️`
}

/** تناوب جولات التردد: مباشرة لطيفة / ناعمة / خيارين — يبني ثقة دون إلحاح */
function hesitationToneFromTurns(checkoutUserTurnsWithCart: number): 0 | 1 | 2 {
  const n = Math.max(0, Math.floor(checkoutUserTurnsWithCart))
  return (n % 3) as 0 | 1 | 2
}

type HesitationToneStats = { exposures: [number, number, number]; conversions: [number, number, number] }

function parseToneStatsRows(data: unknown): HesitationToneStats | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const order = ['direct', 'soft', 'choice'] as const
  const ex: [number, number, number] = [0, 0, 0]
  const cv: [number, number, number] = [0, 0, 0]
  for (const row of data) {
    if (!row || typeof row !== 'object') continue
    const r = row as { tone?: string; exposures?: unknown; conversions?: unknown }
    const i = order.indexOf((r.tone ?? '') as (typeof order)[number])
    if (i < 0) continue
    ex[i] = Number(r.exposures) || 0
    cv[i] = Number(r.conversions) || 0
  }
  return { exposures: ex, conversions: cv }
}

/** Minimum exposure events (all tones) before biasing toward best converters; else rotation. */
const HESITATION_MIN_TOTAL_EXPOSURES = 30
const HESITATION_EXPLORATION_RATE = 0.12

function pickHesitationToneAdaptive(
  checkoutUserTurnsWithCart: number,
  stats: HesitationToneStats | null
): { tone: 0 | 1 | 2; source: 'rotation' | 'adaptive' } {
  const total = stats ? stats.exposures[0] + stats.exposures[1] + stats.exposures[2] : 0
  if (!stats || total < HESITATION_MIN_TOTAL_EXPOSURES) {
    return { tone: hesitationToneFromTurns(checkoutUserTurnsWithCart), source: 'rotation' }
  }
  if (Math.random() < HESITATION_EXPLORATION_RATE) {
    return { tone: (Math.floor(Math.random() * 3) % 3) as 0 | 1 | 2, source: 'adaptive' }
  }
  const w = [0, 1, 2].map((i) => {
    const e = stats.exposures[i] ?? 0
    const c = stats.conversions[i] ?? 0
    return (c + 1) / (e + 2)
  })
  const sum = w.reduce((a, b) => a + b, 0) || 1
  let r = Math.random() * sum
  for (let i = 0; i < 3; i++) {
    r -= w[i]
    if (r <= 0) return { tone: i as 0 | 1 | 2, source: 'adaptive' }
  }
  return { tone: 2, source: 'adaptive' }
}

function buildCartContextBlockForBrain(
  cartLineCount: number,
  cartTotalQty: number,
  offerCheckoutThisTurn: boolean,
  hesitationMode: boolean,
  hesitationTone: 0 | 1 | 2
): string {
  if (cartLineCount <= 0) return ''
  const phrase = cartSummaryPhrase(cartLineCount)
  const qtyLine = cartTotalQty > 0 ? String(cartTotalQty) : String(cartLineCount)
  let s = `## سلة التسوق (من التطبيق — حيّة)
- ${phrase}
- أنواع في السلة: ${cartLineCount} — إجمالي القطع: ${qtyLine}
`
  if (hesitationMode) {
    const toneHint =
      hesitationTone === 0
        ? '**هذه الجولة — نبرة مباشرة لطيفة**: يمكن ذكر السلة باختصار ثم "تبين نكمل الطلب الحين؟ ✨" — بدون ضغط بيع.'
        : hesitationTone === 1
          ? '**هذه الجولة — نبرة ناعمة**: ركّزي على: "إذا حابة نكمل الطلب الحين أرتبه لك بسرعة ✨" — كمساعدة لا كمندوبة مبيعات.'
          : '**هذه الجولة — نبرة مساعدة بخيارين**: "تبين نكمل الطلب أو أختار لك خيار ثاني؟" — تقديري لوقتها، بدون إلحاح.'
    s += `- **تردد مريح**: السلة غير فارغة ومرّت جولات بدون الضغط على «إتمام الطلب». ${toneHint}
- لا تكرري جمل عجلة أو ندرة إلا إن ناسبت السياق — الأولوية للثقة والوضوح.
- زر الواجهة **إتمام الطلب** → /checkout (دعم للي تبغى تكمل، لا إجبار).
`
  } else if (offerCheckoutThisTurn) {
    s += `- **هذه الجولة**: شجّعي بلطف على إتمام الطلب:
  - "${phrase}" ثم "تبين نكمل الطلب الحين؟ ✨"
  - زر الواجهة **إتمام الطلب** → /checkout
`
  } else {
    s += `- يمكن ذكر السلة باختصار عند الصلة دون ضغط.\n`
  }
  return s
}

function appendCheckoutConversionLines(reply: string, cartLineCount: number): string {
  if (cartLineCount <= 0) return reply
  let t = reply.trim()
  const line1 = cartSummaryPhrase(cartLineCount)
  const line2 = 'تبين نكمل الطلب الحين؟ ✨'
  if (line1 && !/سلتك\s*فيها/i.test(t)) t = `${t}\n\n${line1}`
  if (!/نكمل\s*الطلب\s*الحين/i.test(t)) t = `${t}\n\n${line2}`
  return t
}

/**
 * جولة 2+ مع سلة وبدون ضغط «إتمام الطلب» من روزي.
 * يتناوب: مباشرة لطيفة / ناعمة / خيارين — يقلّل الإحساس بالبيع.
 */
function appendHesitationCheckoutLines(
  reply: string,
  hesitationTone: 0 | 1 | 2,
  cartLineCount: number
): string {
  let t = reply.trim()
  const phrase = cartSummaryPhrase(cartLineCount)

  if (hesitationTone === 0) {
    if (phrase && !/سلتك\s*فيها/i.test(t)) t = `${t}\n\n${phrase}`
    if (!/نكمل\s*الطلب\s*الحين/i.test(t)) t = `${t}\n\nتبين نكمل الطلب الحين؟ ✨`
    return t
  }
  if (hesitationTone === 1) {
    const soft = 'إذا حابة نكمل الطلب الحين أرتبه لك بسرعة ✨'
    if (!/إذا\s*حابة\s*نكمل\s*الطلب\s*الحين/i.test(t) && !/أرتبه\s*لك\s*بسرعة/i.test(t)) {
      t = `${t}\n\n${soft}`
    }
    return t
  }
  const choice = 'تبين نكمل الطلب أو أختار لك خيار ثاني؟'
  if (!/نكمل\s*الطلب\s*أو\s*أختار/i.test(t)) t = `${t}\n\n${choice}`
  return t
}

function buildProductConversionActions(picks: RozyProductOut[]): RozyActionOut[] {
  const out: RozyActionOut[] = []
  for (const p of picks) {
    const shortName = p.name_ar.length > 30 ? `${p.name_ar.slice(0, 28)}…` : p.name_ar
    out.push({
      id: `rozy-view-product-${p.id}`,
      label: `عرض ${shortName}`,
      kind: 'view_product',
      product_id: p.id,
      product_name_ar: p.name_ar,
      product_price: p.price,
      product_image_url: p.image_url,
      product_brand_ar: p.brand_ar,
    })
    out.push({
      id: `rozy-add-cart-${p.id}`,
      label: 'أضف للسلة 🛍️',
      kind: 'add_to_cart',
      product_id: p.id,
      product_name_ar: p.name_ar,
      product_price: p.price,
      product_image_url: p.image_url,
      product_brand_ar: p.brand_ar,
    })
  }
  return out
}

function shouldIncludeSalonCards(intent: IntentName, utterance: string): boolean {
  if (intent === 'store_products') return false
  if (intent === 'search_salon' || intent === 'recommend_service' || intent === 'booking_request') return true
  if (intent !== 'general_question') return false
  return /صالون|حجز|موعد|سبا|أظافر|شعر|ليزر|مكياج|تجميل|عيادة|أقرب|تقييم|رخيص|سعر|غال[يى]|غالي|خصم|أرخص|ارخص|ابي\s*خصم|أبي\s*خصم|ابغى\s*خصم|فيه\s*أرخص|في\s*أرخص|وش\s*الأفضل|وش\s*احسن|دلّيني|دليني|نصايح|اقتراح/i.test(
    utterance
  )
}

function rankSalonsForRosy(
  salons: SalonRow[],
  reco: UserRecommendationHistory,
  userLatLng: { lat: number; lng: number } | null,
  flags: {
    luxury?: boolean
    priceSensitive?: boolean
    similarToBooked?: boolean
    urgentToday?: boolean
    preferredPriceRange?: string | null
  }
): SalonRow[] {
  const scored = salons.map((s) => {
    const lat = Number(s.latitude)
    const lng = Number(s.longitude)
    let dist = 0
    if (userLatLng && Number.isFinite(lat) && Number.isFinite(lng)) {
      dist = haversineKm(userLatLng.lat, userLatLng.lng, lat, lng)
    }
    const rating = Number(s.average_rating ?? 0)
    const bookings = Number(s.total_bookings ?? 0)
    let score = rating * 4.2 + Math.log1p(Math.max(0, bookings)) * 2.8
    const sub = s.subscription_plan
    if (sub === 'premium') score += 50
    else if (sub === 'pro') score += 25
    if (s.is_featured) score += 40
    if (s.has_active_featured_ad) score += FEATURED_AD_RANK_BOOST
    if (reco.favoriteBusinessIds.has(s.id)) score += 6
    if (reco.bookedBusinessIds.has(s.id)) score += 9
    if (userLatLng && dist > 0 && Number.isFinite(dist)) {
      const distW = flags.urgentToday ? 0.38 : 0.22
      score -= Math.min(dist, 80) * distW
    }
    if (flags.luxury) {
      score += rating >= 4.5 ? 4 : 0
    }
    if (flags.priceSensitive) {
      score += rating > 0 && rating <= 4.2 ? 2 : 0
      const pr = (s.price_range || '').toLowerCase()
      if (/\$|econom|low|اقتصاد|منخفض|رخيص|budget/i.test(pr)) score += 5
      const pref = flags.preferredPriceRange?.trim()
      if (pref && s.price_range && s.price_range.trim() === pref) score += 10
    }
    return { s, score, dist }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.s)
}

function partitionFeaturedSalonsFirst(salons: SalonRow[]): SalonRow[] {
  const withAd: SalonRow[] = []
  const rest: SalonRow[] = []
  for (const s of salons) {
    if (s.has_active_featured_ad) withAd.push(s)
    else rest.push(s)
  }
  return [...withAd, ...rest]
}

function salonsToPayload(rows: SalonRow[], userLatLng: { lat: number; lng: number } | null): RozySalonOut[] {
  return rows.slice(0, 3).map((s) => {
    const lat = Number(s.latitude)
    const lng = Number(s.longitude)
    let distance_km: number | null = null
    if (userLatLng && Number.isFinite(lat) && Number.isFinite(lng)) {
      distance_km = Math.round(haversineKm(userLatLng.lat, userLatLng.lng, lat, lng) * 10) / 10
    }
    return {
      id: s.id,
      name_ar: s.name_ar,
      average_rating: s.average_rating,
      distance_km,
      cover_image: s.cover_image ?? null,
      google_photo_resource: s.google_photo_resource ?? null,
    }
  })
}

function buildActionsForSalons(salons: RozySalonOut[]): RozyActionOut[] {
  if (salons.length === 0) return []
  const first = salons[0]
  return [
    { id: 'book_now', label: 'احجزي الآن', salon_id: first.id, kind: 'book' },
    { id: 'more_options', label: 'شوفي خيارات ثانية', kind: 'more' },
  ]
}

type ServiceRow = ServiceForRank

type ProductRow = ProductForRank

type ProfileRow = {
  id: string
  full_name: string | null
  city: string | null
  preferred_language: string | null
}

type SkinContextRow = {
  skin_type: string | null
  issues: string[] | null
  analysis_result: Record<string, unknown> | null
  created_at: string
}

const EVENT_HALFLIFE_DAYS = 14

function emptyRecoHistory(): UserRecommendationHistory {
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

function decayFactorReco(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / EVENT_HALFLIFE_DAYS)
}

function bumpRecoScore(map: Map<string, number>, id: string, delta: number) {
  if (!id) return
  map.set(id, (map.get(id) ?? 0) + delta)
}

async function fetchRecoHistory(sb: SupabaseClient, userId: string): Promise<UserRecommendationHistory> {
  const h = emptyRecoHistory()
  const [bookingsRes, favRes, itemsRes, eventsRes] = await Promise.all([
    sb.from('bookings').select('business_id, service_id, service_ids').eq('user_id', userId),
    sb.from('favorites').select('business_id').eq('user_id', userId),
    sb
      .from('order_items')
      .select('product_id, orders!inner(user_id)')
      .eq('orders.user_id', userId),
    sb
      .from('user_events')
      .select('event_type, entity_type, entity_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(400),
  ])

  if (bookingsRes.error) console.warn('[rozi-chat] bookings history', bookingsRes.error.message)
  if (favRes.error) console.warn('[rozi-chat] favorites history', favRes.error.message)
  if (itemsRes.error) console.warn('[rozi-chat] order_items history', itemsRes.error.message)
  if (eventsRes.error) console.warn('[rozi-chat] user_events history', eventsRes.error.message)

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
    const d = decayFactorReco(r.created_at)
    const w =
      r.event_type === 'book'
        ? 1.15
        : r.event_type === 'click'
          ? 0.5
          : r.event_type === 'user_preference'
            ? 0.55
            : 0.15
    const add = w * d
    if (r.entity_type === 'service') bumpRecoScore(h.serviceEventScore, r.entity_id, add)
    else if (r.entity_type === 'product') bumpRecoScore(h.productEventScore, r.entity_id, add)
    else if (r.entity_type === 'business') bumpRecoScore(h.businessEventScore, r.entity_id, add)
  }
  return h
}

function skinPayloadFromRow(row: SkinContextRow | null): SkinPayloadForRank | null {
  const ar = row?.analysis_result
  if (!ar || typeof ar !== 'object') return null
  const o = ar as Record<string, unknown>
  const concerns = Array.isArray(o.concerns) ? (o.concerns as unknown[]).map((x) => String(x)) : undefined
  const rt = Array.isArray(o.recommended_treatments)
    ? (o.recommended_treatments as unknown[]).map((x) => String(x))
    : undefined
  const rs = Array.isArray(o.recommended_services) ? (o.recommended_services as unknown[]).map((x) => String(x)) : undefined
  return {
    skin_type: typeof o.skin_type === 'string' ? o.skin_type : row?.skin_type ?? undefined,
    concerns,
    recommended_treatments: rt,
    recommended_services: rs,
  }
}

const INTENTS: IntentName[] = [
  'search_salon',
  'recommend_service',
  'booking_request',
  'store_products',
  'general_question',
]

function readOpenAiApiKey(): string {
  const raw = Deno.env.get('OPENAI_API_KEY')?.trim() || ''
  let k = raw
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r?\n/g, '').replace(/\s+/g, '')
}

async function openaiComplete(apiKey: string, messages: OpenAIChatMessage[], maxTokens = 1200): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.55,
      max_tokens: maxTokens,
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI ${res.status}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty OpenAI response')
  }
  return text.trim()
}

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 400): Promise<T> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: maxTokens,
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI ${res.status}`)
  }

  const raw = data.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Empty JSON from OpenAI')
  }
  return JSON.parse(raw) as T
}

function normalizeIntent(x: string | undefined): IntentName {
  if (x && (INTENTS as string[]).includes(x)) return x as IntentName
  return 'general_question'
}

function lastUserText(messages: Msg[], hasImage: boolean): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.trim()
    }
  }
  if (hasImage) return 'تحليل صورة الوجه للبشرة والعناية'
  return ''
}

function formatHistoryLines(
  rows: { message: string | null; response: string | null; is_user: boolean | null; created_at: string }[]
): string {
  return rows
    .slice()
    .reverse()
    .map((r) => {
      if (r.is_user) return `المستخدم: ${(r.message || '').slice(0, 500)}`
      return `روزي: ${(r.response || r.message || '').slice(0, 500)}`
    })
    .join('\n')
}

function defaultSlots(): string[] {
  return ['10:00', '14:00', '17:00']
}

function pickSlotsFromOpeningHours(oh: Record<string, { open: string; close: string }> | null | undefined): string[] {
  if (!oh || typeof oh !== 'object') return defaultSlots()
  const day = oh['السبت'] || oh['الأحد'] || Object.values(oh)[0]
  const openStr = day?.open
  if (!openStr || typeof openStr !== 'string') return defaultSlots()
  const h = parseInt(openStr.split(':')[0] ?? '', 10)
  if (!Number.isFinite(h) || h < 8 || h > 20) return defaultSlots()
  const a = `${String(h).padStart(2, '0')}:00`
  const b = `${String(Math.min(h + 4, 20)).padStart(2, '0')}:00`
  const c = `${String(Math.min(h + 7, 21)).padStart(2, '0')}:00`
  return [a, b, c]
}

const SALON_SELECT =
  'id,name_ar,city,city_id,category,category_label,average_rating,address_ar,opening_hours,latitude,longitude,total_bookings,cover_image,google_photo_resource,price_range,is_featured,rosy_pricing_flexible,rosy_discount_allowed,rosy_max_discount_percent'

function utteranceWantsPriceNegotiation(utterance: string): boolean {
  const t = utterance.trim()
  if (!t) return false
  return /غال[يى]|غالي|غاليه|أرخص|ارخص|رخيص|خصم|تخفيض|سعر\s*عالي|فيه\s*أرخص|في\s*أرخص|ابي\s*خصم|أبي\s*خصم|ابغى\s*خصم|ابغي\s*خصم|مبالغ\s*في|غالي\s*علي|expensive|too\s*much/i.test(
    t
  )
}

function pickFocusSalonIdForNegotiation(
  rankedSalons: SalonRow[],
  entities: Record<string, unknown>
): string | null {
  const hint = typeof entities.salon_hint === 'string' ? entities.salon_hint.trim() : ''
  const q = typeof entities.query === 'string' ? entities.query.trim() : ''
  if (hint) {
    const h = hint.toLowerCase()
    const hit = rankedSalons.find((s) => s.name_ar.toLowerCase().includes(h))
    if (hit) return hit.id
  }
  if (q) {
    const ql = q.toLowerCase()
    const hit = rankedSalons.find((s) => s.name_ar.toLowerCase().includes(ql))
    if (hit) return hit.id
  }
  return rankedSalons[0]?.id ?? null
}

type NegotiationPack = {
  systemAppendix: string
  replyPrefix: string
  actions: RozyActionOut[]
}

function buildPriceNegotiationPack(
  focus: SalonRow,
  servicesAll: ServiceRow[],
  rankedSalons: SalonRow[]
): NegotiationPack {
  const flex = focus.rosy_pricing_flexible !== false
  const discAllowed = focus.rosy_discount_allowed === true
  const maxDisc = Math.min(15, Math.max(0, Number(focus.rosy_max_discount_percent ?? 10)))

  const svcFocus = servicesAll.filter((s) => s.business_id === focus.id && Number(s.price) > 0)
  const sorted = [...svcFocus].sort((a, b) => Number(a.price) - Number(b.price))
  const cheapest = sorted[0]
  const priciest = sorted.length ? sorted[sorted.length - 1] : null

  let cheaperSameSalon: { id: string; name_ar: string; price: number } | null = null
  if (flex && cheapest && priciest && cheapest.id !== priciest.id && Number(cheapest.price) < Number(priciest.price)) {
    cheaperSameSalon = {
      id: cheapest.id,
      name_ar: cheapest.name_ar,
      price: Math.round(Number(cheapest.price) * 100) / 100,
    }
  }

  let altSalonId: string | null = null
  let altMin = Infinity
  let altName: string | null = null
  if (flex) {
    const focusMin = sorted.length ? Number(sorted[0].price) : Infinity
    for (const s of rankedSalons) {
      if (s.id === focus.id) continue
      const mins = servicesAll
        .filter((x) => x.business_id === s.id)
        .map((x) => Number(x.price))
        .filter((p) => p > 0)
      const m = mins.length ? Math.min(...mins) : Infinity
      if (m < altMin && Number.isFinite(m) && m < focusMin - 0.01) {
        altMin = m
        altSalonId = s.id
        altName = s.name_ar
      }
    }
  }

  let appliedDiscountPercent: number | null = null
  let anchorPrice: number | null = null
  let discountedPrice: number | null = null
  if (discAllowed && maxDisc >= 5) {
    const chosen = Math.min(maxDisc, 10)
    appliedDiscountPercent = chosen
    anchorPrice = priciest ? Number(priciest.price) : cheapest ? Number(cheapest.price) : null
    if (anchorPrice != null && anchorPrice > 0) {
      discountedPrice = Math.round(anchorPrice * (1 - chosen / 100) * 100) / 100
    }
  }

  const lines: string[] = []
  lines.push(`## تفاوض السعر (روزي) — بيانات من النظام؛ التزمي بها حرفياً`)
  lines.push(
    `- الصالون المحوري: **${focus.name_ar}** (\`${focus.id}\`) — اقتراح بدائل أرخص: **${flex ? 'مسموح' : 'غير مسموح'}** — خصم إضافي عبر روزي: **${discAllowed && maxDisc >= 5 ? `مسموح حتى ${maxDisc}%` : 'غير مسموح'}**.`
  )
  if (cheaperSameSalon && priciest) {
    lines.push(
      `- في **نفس الصالون** خدمة أوفر: **${cheaperSameSalon.name_ar}** بسعر **${cheaperSameSalon.price}** ر.س (مقارنة بأغلى خدمات تصل إلى **${Math.round(Number(priciest.price) * 100) / 100}** ر.س).`
    )
  } else if (!flex) {
    lines.push(`- لا تقترحي خدمات بديلة أرخص داخل نفس الصالون (المرونة معطّلة لصاحبة الصالون).`)
  }
  if (altSalonId && altName && Number.isFinite(altMin)) {
    lines.push(
      `- **بديل أرخص قريب** في النتائج: **${altName}** (\`${altSalonId}\`) — أقل سعر خدمة تقريباً **${Math.round(altMin * 100) / 100}** ر.س. يمكن قول: «أو عندي خيار قريب بنفس الجودة بس أرخص 👇».`
    )
  }
  if (discAllowed && appliedDiscountPercent != null && anchorPrice != null && discountedPrice != null) {
    lines.push(
      `- **مسموح** عرض خصم إضافي **${appliedDiscountPercent}%** فقط (لا تتجاوزي ${maxDisc}%). مثال على أغلى خدمة في القائمة: **${Math.round(anchorPrice * 100) / 100}** → **${discountedPrice}** ر.س. صيغي: «أقدر أضبط لك خصم بسيط ✨ يصير السعر **${discountedPrice}** بدل **${Math.round(anchorPrice * 100) / 100}**» عندما يناسب السياق.`
    )
  } else {
    lines.push(
      `- **ممنوع** وعد بنسبة خصم أو سعر مخفّض لهذا الصالون. اقتصري على البدائل الواردة أعلاه أو لطف عام بدون أرقام خصم.`
    )
  }
  lines.push(`- أضيفي جملة إلحاح واحدة: **العرض متاح اليوم فقط 🔥** (أسلوب تسويقي خفيف).`)
  lines.push(
    `- جملة «أفهمك 💖 خليني أشوف لك خيار أفضل» تُعرَض تلقائياً قبل ردك؛ تابعي مباشرة بعدها **بدون** تكرار نفس الجملة حرفياً.`
  )
  lines.push(`- لا تختلقي أسعاراً أو نسباً غير مذكورة هنا.`)

  const actions: RozyActionOut[] = []
  if (appliedDiscountPercent != null && appliedDiscountPercent > 0 && discAllowed) {
    actions.push({
      id: 'rosy-negotiated-book',
      label: 'احجزي بالسعر الجديد',
      salon_id: focus.id,
      kind: 'negotiated_book',
      service_id: cheaperSameSalon?.id ?? null,
      discount_percent: appliedDiscountPercent,
    })
  }

  return {
    systemAppendix: lines.join('\n'),
    replyPrefix: 'أفهمك 💖 خليني أشوف لك خيار أفضل\n\n',
    actions,
  }
}

type BizMini = { name_ar?: string | null; category_label?: string | null }

function unwrapBiz<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

type MemoryPack = { narrative: string; preferredPriceRange: string | null }

async function fetchMemoryPack(sb: SupabaseClient, userId: string): Promise<MemoryPack> {
  const lines: string[] = []
  let preferredPriceRange: string | null = null

  try {
    const { data: bk } = await sb
      .from('bookings')
      .select('created_at,businesses(name_ar,category_label)')
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const b = unwrapBiz((bk as { businesses?: BizMini | BizMini[] | null })?.businesses) as BizMini | null
    if (b?.name_ar?.trim()) {
      const cl = b.category_label?.trim() || ''
      lines.push(`- آخر حجز: صالون «${b.name_ar.trim()}»${cl ? ` (${cl})` : ''}`)
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: favRows } = await sb
      .from('favorites')
      .select('businesses(name_ar)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    const names: string[] = []
    for (const row of favRows ?? []) {
      const x = unwrapBiz((row as { businesses?: { name_ar?: string | null } | null }).businesses)
      const n = x && typeof (x as { name_ar?: string }).name_ar === 'string' ? (x as { name_ar: string }).name_ar.trim() : ''
      if (n) names.push(n)
    }
    if (names.length) lines.push(`- مفضلات: ${names.join('، ')}`)
  } catch {
    /* ignore */
  }

  try {
    const { data: evs } = await sb
      .from('user_events')
      .select('metadata,created_at')
      .eq('user_id', userId)
      .eq('event_type', 'user_preference')
      .order('created_at', { ascending: false })
      .limit(48)

    const svc = new Set<string>()
    const prices = new Map<string, number>()
    const locs = new Map<string, number>()
    for (const r of evs ?? []) {
      const m = r.metadata as Record<string, unknown> | null
      if (!m || typeof m !== 'object') continue
      if (typeof m.service === 'string' && m.service.trim()) svc.add(m.service.trim())
      if (typeof m.price_range === 'string' && m.price_range.trim()) {
        const p = m.price_range.trim()
        prices.set(p, (prices.get(p) ?? 0) + 1)
      }
      if (typeof m.location === 'string' && m.location.trim()) {
        const loc = m.location.trim()
        locs.set(loc, (locs.get(loc) ?? 0) + 1)
      }
    }
    if (svc.size) lines.push(`- اهتمامات خدمات من السلوك: ${[...svc].join('، ')}`)
    const topPrice = [...prices.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topPrice) {
      lines.push(`- نطاق سعر يُفضّل (من السلوك): ${topPrice}`)
      preferredPriceRange = topPrice
    }
    const topLoc = [...locs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topLoc) lines.push(`- مدينة/منطقة مفضلة: ${topLoc}`)
  } catch {
    /* ignore */
  }

  if (lines.length === 0) return { narrative: '', preferredPriceRange: null }

  const narrative = `## ذاكرة وتفضيلات المستخدمة (حقيقية — لا تعيدي سؤالاً إن وُجد الجواب هنا)
${lines.join('\n')}
- **لا تكرري** نفس السؤال إن أجابت المستخدمة سابقاً في المحادثة.
- عند أول توصية مناسبة يمكنكِ مرة واحدة جملة مثل: «آخر مرة حجزتي أظافر 💅 تبغي نفس الشي اليوم؟» إن كانت «أظافر/nails» ضمن الاهتمامات أو آخر حجز واضح.
- هدفكِ دائماً تقريبها من **الحجز** بلطف (CTA قصير).`

  return { narrative, preferredPriceRange }
}

async function attachActiveSubscriptionPlans(sb: SupabaseClient, salons: SalonRow[]): Promise<void> {
  if (salons.length === 0) return
  try {
    await sb.rpc('expire_salon_subscriptions')
  } catch {
    /* ignore */
  }
  const ids = salons.map((s) => s.id)
  const now = new Date().toISOString()
  const { data } = await sb
    .from('salon_subscriptions')
    .select('salon_id, plan')
    .in('salon_id', ids)
    .eq('status', 'active')
    .gt('expires_at', now)

  const rank = (p: string) => (p === 'premium' ? 3 : p === 'pro' ? 2 : p === 'basic' ? 1 : 0)
  const map = new Map<string, 'basic' | 'pro' | 'premium'>()
  for (const row of data ?? []) {
    const sid = row.salon_id as string
    const plan = row.plan as string
    if (plan !== 'basic' && plan !== 'pro' && plan !== 'premium') continue
    const cur = map.get(sid)
    if (!cur || rank(plan) > rank(cur)) map.set(sid, plan as 'basic' | 'pro' | 'premium')
  }
  for (const s of salons) {
    s.subscription_plan = map.get(s.id) ?? null
  }
}

async function attachSalonFeaturedAds(sb: SupabaseClient, salons: SalonRow[]): Promise<void> {
  if (salons.length === 0) return
  try {
    await sb.rpc('expire_salon_ads')
  } catch {
    /* ignore */
  }
  const ids = salons.map((s) => s.id)
  const t = new Date().toISOString().slice(0, 10)
  const { data } = await sb
    .from('salon_ads')
    .select('salon_id')
    .in('salon_id', ids)
    .eq('status', 'active')
    .lte('start_date', t)
    .gte('end_date', t)
  const set = new Set<string>()
  for (const row of data ?? []) {
    const sid = (row as { salon_id?: string }).salon_id
    if (sid) set.add(sid)
  }
  for (const s of salons) {
    s.has_active_featured_ad = set.has(s.id)
  }
}

type SalonOwnerB2BContext = {
  is_owner: boolean
  salon_id: string | null
  salon_name_ar: string | null
  plan: 'basic' | 'pro' | 'premium' | null
}

type SalonOwnerSalesMetrics = {
  impressions_7d: number
  clicks_7d: number
  bookings_7d: number
}

type RosyUpsellStateRow = {
  last_cta_at: string
  follow_up_at: string | null
}

type SalonSubscriptionUpsellDecision = {
  showCta: boolean
  followUpMode: boolean
  rpcMode: 'primary' | 'follow_up' | null
  analyticsLines: string
}

async function fetchSalonOwnerB2BContext(sb: SupabaseClient, userId: string): Promise<SalonOwnerB2BContext> {
  const { data: soRows } = await sb.from('salon_owners').select('salon_id').eq('user_id', userId).limit(1)
  let salonId = (soRows?.[0] as { salon_id?: string } | undefined)?.salon_id
  if (!salonId) {
    const { data: ob } = await sb.from('businesses').select('id').eq('owner_id', userId).limit(1).maybeSingle()
    salonId = (ob as { id?: string } | null)?.id
  }
  if (!salonId) {
    return { is_owner: false, salon_id: null, salon_name_ar: null, plan: null }
  }
  const { data: bizFull } = await sb.from('businesses').select('name_ar').eq('id', salonId).maybeSingle()
  const nameAr = (bizFull as { name_ar?: string } | null)?.name_ar ?? null
  try {
    await sb.rpc('expire_salon_subscriptions')
  } catch {
    /* ignore */
  }
  const now = new Date().toISOString()
  const { data: subRows } = await sb
    .from('salon_subscriptions')
    .select('plan')
    .eq('salon_id', salonId)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
  const row = subRows?.[0] as { plan?: string } | undefined
  const p = row?.plan
  const plan = p === 'basic' || p === 'pro' || p === 'premium' ? (p as 'basic' | 'pro' | 'premium') : null
  return { is_owner: true, salon_id: salonId, salon_name_ar: nameAr, plan }
}

function ownerMentionedSalonBusinessVisibility(utterance: string): boolean {
  return /صالوني|صالون\s*حقتي|صاحبة\s*صالون|مالكة\s*صالون|زباين|زبائن|عملاء|ما\s*يجيني|قليل\s*حجوز|حجوزات\s*قليل|ظهور|ترتيب|أول\s*القائمة|نمو|تسويق|اشتراك|باقة|بريميوم|مميزة|premium|ترويج|وضوح|مش\s*ظاهر|ليه\s*ما\s*يطلع/i.test(
    utterance
  )
}

function computeSalonSubscriptionUpsellDecision(
  ctx: SalonOwnerB2BContext,
  metrics: SalonOwnerSalesMetrics,
  rankedForCity: SalonRow[],
  utterance: string,
  state: RosyUpsellStateRow | null,
  hadClickSinceLastCta: boolean
): SalonSubscriptionUpsellDecision {
  const analyticsLines = `- انطباعات (مشاهدات/ظهور في التطبيق) آخر 7 أيام: **${metrics.impressions_7d}**
- نقرات ذات صلة آخر 7 أيام: **${metrics.clicks_7d}**
- حجوزات (حسب تاريخ اليوم في الحجز) آخر 7 أيام: **${metrics.bookings_7d}**`

  if (!ctx.is_owner || ctx.plan === 'premium') {
    return { showCta: false, followUpMode: false, rpcMode: null, analyticsLines }
  }

  const utteranceTriggered = ownerMentionedSalonBusinessVisibility(utterance)

  if (hadClickSinceLastCta && !utteranceTriggered) {
    return { showCta: false, followUpMode: false, rpcMode: null, analyticsLines }
  }

  if (utteranceTriggered) {
    return { showCta: true, followUpMode: false, rpcMode: 'primary', analyticsLines }
  }

  const idx = ctx.salon_id ? rankedForCity.findIndex((s) => s.id === ctx.salon_id) : -1
  const n = rankedForCity.length
  const notInTop = n === 0 ? false : idx < 0 ? n >= 4 : idx >= 4
  const lowBookings = metrics.bookings_7d <= 2
  const lowVisibilitySignals = metrics.impressions_7d < 20 && metrics.clicks_7d < 10
  const trafficNoConversion = metrics.impressions_7d >= 35 && metrics.bookings_7d <= 3
  const dataTriggered = notInTop || lowBookings || trafficNoConversion || lowVisibilitySignals

  const now = Date.now()
  const lastCtaMs = state?.last_cta_at ? new Date(state.last_cta_at).getTime() : 0
  const daysSinceCta = lastCtaMs > 0 ? (now - lastCtaMs) / 86_400_000 : 999

  if (
    state &&
    !state.follow_up_at &&
    daysSinceCta >= 2 &&
    daysSinceCta < 14 &&
    lastCtaMs > 0
  ) {
    return {
      showCta: true,
      followUpMode: true,
      rpcMode: 'follow_up',
      analyticsLines,
    }
  }

  const throttlePrimary = daysSinceCta < 3 && lastCtaMs > 0
  if (dataTriggered && !throttlePrimary) {
    return { showCta: true, followUpMode: false, rpcMode: 'primary', analyticsLines }
  }

  return { showCta: false, followUpMode: false, rpcMode: null, analyticsLines }
}

function buildSalonOwnerSubscriptionSalesSystemAppendix(
  ctx: SalonOwnerB2BContext,
  rankedForCity: SalonRow[],
  decision: SalonSubscriptionUpsellDecision
): string {
  if (!ctx.is_owner || ctx.plan === 'premium') return ''
  const idx = ctx.salon_id ? rankedForCity.findIndex((s) => s.id === ctx.salon_id) : -1
  const rankLine =
    rankedForCity.length === 0
      ? '- لا توجد قائمة نتائج مدينة مُحسّنة حالياً لهذا السياق.'
      : idx >= 0
        ? `- ترتيب صالونها **التقريبي** في نتائج مدينتها ضمن بيانات روزي الحالية: **${idx + 1}/${rankedForCity.length}** (بعد ترتيب الظهور الداخلي).`
        : `- صالونها **ليس ضمن أعلى النتائج** في القائمة الحالية لمدينتها (${rankedForCity.length} صالوناً معروضاً).`
  const planLabel = ctx.plan === 'pro' ? 'Pro' : ctx.plan === 'basic' ? 'Basic' : 'لا يوجد اشتراك B2B فعّال'

  const pitchBlock = decision.showCta
    ? decision.followUpMode
      ? `- **متابعة بعد يومين** — المستخدمة لم تضغط «تفعيل الآن» بعد العرض السابق. ذكّريها بلطف بجملة قصيرة ثم اربطي بأرقام الأداء أدناه إن وُجدت.
- أضيفي سطراً عن **عرض خاص اليوم ✨ خصم 20%** كـ حافز (تسويقي — إن لم يكن الخصم مفعّلاً في المنتج فصيغيها كاقتراح عام دون وعد سعر).`
      : `- **مساعدة مبيعات ذكية**: استخدمي أرقام الأداء أدناه لتخصيص الرد (مثال أسلوب: «صالونك انشاف X مرة هذا الأسبوع لكن الحجوزات قليلة…»).
- **الجملة الأساسية** (حافظي على المعنى؛ يمكن تقسيم سطرين):
«لاحظت إن ظهور صالونك قليل 😔
لو ترقينه لباقة مميزة ⭐
راح يزيد عدد الحجوزات بشكل واضح ✨»
- **إلحاح تسويقي** — أضيفي مرة واحدة قريبة من نهاية الجزء الترويجي:
«عرض خاص اليوم ✨ خصم 20%»
(إن كان الخصم غير مفعّل في النظام، قدّميه كـ «عرض ترويجي» بدون ضمان فني.)
- في الواجهة سيظهر زر **تفعيل الآن**؛ لا تكرري روابط يدوية لنفس الغرض.
- إن كانت المستخدمة تتكلّم بالصوت: جمل **قصيرة**، نبرة ودودة وناعمة، ختام بسؤال يقبل «اي / تمام»؛ اربطي بأرقام المشاهدات والحجوزات والترتيب عندما تكون في سياق البيانات أدناه.
- **لا تبالغي**: جزء ترويجي واحد مختصر في هذا الرد.`
    : `- لا تبيعي الاشتراك في **هذا** الرد إلا إن سألت صراحة عن عملاء أو ظهور أو نمو؛ عندها استخدمي نفس أسلوب المبيعات أعلاه باختصار.`

  return `

## أنتِ مساعدة مبيعات ذكية لروزيرا — صاحبات الصالونات (داخلي)
- هذه المستخدمة **مالكة صالون**: «${ctx.salon_name_ar || 'صالونها المسجل'}». الخطة الحالية: **${planLabel}** (ليست Premium ⭐).
${rankLine}
## أداء الصالون في التطبيق (7 أيام — بيانات حقيقية)
${decision.analyticsLines}
${pitchBlock}`
}

async function fetchSalonsForUser(
  sb: SupabaseClient,
  profileCity: string,
  intent: IntentName,
  entities: Record<string, unknown>
): Promise<SalonRow[]> {
  let q = sb.from('businesses').select(SALON_SELECT).eq('is_active', true).eq('is_demo', false)

  const searchQ = typeof entities.query === 'string' ? entities.query.trim() : ''
  const salonHint = typeof entities.salon_hint === 'string' ? entities.salon_hint.trim() : ''

  if ((intent === 'search_salon' || intent === 'recommend_service') && searchQ) {
    q = q.ilike('name_ar', `%${searchQ}%`)
  } else if ((intent === 'search_salon' || intent === 'recommend_service') && salonHint) {
    q = q.ilike('name_ar', `%${salonHint}%`)
  } else if (profileCity) {
    q = q.eq('city', profileCity)
  }

  const { data, error } = await q.order('average_rating', { ascending: false }).limit(40)
  if (error) throw error
  let list = (data ?? []) as SalonRow[]
  if (list.length === 0 && profileCity) {
    const fb = await sb
      .from('businesses')
      .select(SALON_SELECT)
      .eq('is_active', true)
      .eq('is_demo', false)
      .order('average_rating', { ascending: false })
      .limit(28)
    if (!fb.error) list = (fb.data ?? []) as SalonRow[]
  }
  await attachActiveSubscriptionPlans(sb, list)
  await attachSalonFeaturedAds(sb, list)
  return list
}

async function fetchServices(sb: SupabaseClient, businessIds: string[], serviceKeyword?: string): Promise<ServiceRow[]> {
  if (businessIds.length === 0) return []
  let q = sb
    .from('services')
    .select(
      'id,business_id,name_ar,category,price,duration_minutes,is_demo, businesses ( total_bookings, average_rating, total_reviews )'
    )
    .in('business_id', businessIds)
    .eq('is_active', true)
    .eq('is_demo', false)
  if (serviceKeyword) {
    q = q.ilike('name_ar', `%${serviceKeyword}%`)
  }
  const { data, error } = await q.limit(96)
  if (error) throw error
  return (data ?? []) as ServiceRow[]
}

async function fetchProducts(sb: SupabaseClient): Promise<ProductRow[]> {
  const { data, error } = await sb
    .from('products')
    .select('id,name_ar,price,category,description_ar,brand_ar,rating,review_count,image_url')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(120)
  if (error) return []
  return (data ?? []) as ProductRow[]
}

function formatSkinContextBlock(row: SkinContextRow | null): string {
  if (!row) return ''
  const ar = row.analysis_result
  const notes = ar && typeof ar.notes_ar === 'string' ? ar.notes_ar : ''
  const sev = ar && typeof ar.severity === 'string' ? ar.severity : ''
  const treat = Array.isArray(ar?.recommended_treatments)
    ? (ar.recommended_treatments as string[]).join('، ')
    : ''
  const svc = Array.isArray(ar?.recommended_services) ? (ar.recommended_services as string[]).join('، ') : ''
  const concerns = (row.issues || []).join('، ')
  return `## تحليل بشرة المستخدمة (من تطبيق روزيرا — تقديري وليس تشخيصاً طبياً)
- تاريخ أحدث تحليل: ${row.created_at || '—'}
- نوع البشرة (تقديري): ${row.skin_type || '—'}
- ملخص عربي من النموذج: ${notes || '—'}
- الشدة التقديرية: ${sev || '—'}
- نقاط الاهتمام: ${concerns || '—'}
- علاجات مقترحة: ${treat || '—'}
- خدمات مناسبة (صالون): ${svc || '—'}

عند السؤال عن البشرة أو التوصية، ابدئي أحياناً بـ "بناءً على تحليل بشرتكِ الأخير في التطبيق..." ثم اربطي النصيحة ببيانات الصالونات/الخدمات أدناه عند التوفر.`
}

function buildBrainContext(params: {
  memoryNarrative: string
  profile: ProfileRow
  historyText: string
  salons: SalonRow[]
  services: ServiceRow[]
  products: ProductRow[]
  skinBlock: string
  rankedServicesLines: string
  rankedProductsLines: string
  storeProductBlock?: string
  cartContextBlock?: string
}): string {
  const {
    memoryNarrative,
    profile,
    historyText,
    salons,
    services,
    products,
    skinBlock,
    rankedServicesLines,
    rankedProductsLines,
    storeProductBlock,
    cartContextBlock,
  } = params
  const mem = memoryNarrative.trim() ? `${memoryNarrative.trim()}\n\n` : ''
  const salonLines =
    salons
      .map((b) => {
        const bits: string[] = []
        if (b.has_active_featured_ad) bits.push('إعلان مميز ⭐')
        if (b.subscription_plan === 'premium' || b.is_featured) bits.push('صالون مميز ⭐')
        else if (b.subscription_plan === 'pro') bits.push('خطة Pro')
        const tag = bits.length ? ` — ${bits.join('، ')}` : ''
        return `- [${b.id}] ${b.name_ar} — ${b.city} — ${b.category_label || b.category || ''} — تقييم ${Number(b.average_rating ?? 0).toFixed(1)} — شعبية حجوزات ${Number(b.total_bookings ?? 0)} — نطاق سعر: ${b.price_range || '—'} — ${b.address_ar || ''}${tag}`
      })
      .join('\n') || '(لا توجد صالونات مطابقة في البيانات)'

  const svcLines =
    services
      .map((s) => `- [${s.id}] لصالون ${s.business_id}: ${s.name_ar} — ${Number(s.price ?? 0).toFixed(0)} ر.س — ${s.duration_minutes ?? '?'} د`)
      .join('\n') || '(لا خدمات في القائمة الحالية)'

  const prodLines =
    products.map((p) => `- [${p.id}] ${p.name_ar} — ${Number(p.price ?? 0).toFixed(0)} ر.س`).join('\n') || '(لا منتجات)'

  const skinSection = skinBlock.trim() ? `${skinBlock}\n\n` : ''

  const storePickSection = storeProductBlock?.trim() ? `${storeProductBlock.trim()}\n\n` : ''
  const cartSection = cartContextBlock?.trim() ? `${cartContextBlock.trim()}\n\n` : ''

  const rankSection =
    rankedServicesLines.trim() || rankedProductsLines.trim()
      ? `## توصيات مرتبة لبشرتكِ وتفضيلاتكِ (استخدمي الأسباب في الرد)
### خدمات (أعلى نقاطاً أولاً)
${rankedServicesLines.trim() || '(لا توجد)'}

### منتجات
${rankedProductsLines.trim() || '(لا توجد)'}

`
      : ''

  return `${mem}## الملف الشخصي
- الاسم: ${profile.full_name || '—'}
- المدينة المفضلة في الملف: ${profile.city || '—'}

${skinSection}${storePickSection}${cartSection}${rankSection}## آخر المحادثات (ملخص)
${historyText || '(بداية المحادثة)'}

## صالونات وعيادات (بيانات حقيقية من قاعدة روزيرا — استخدمي المعرفات [uuid] عند التوصية)
${salonLines}

## خدمات متاحة لهذه الصالونات
${svcLines}

## منتجات المتجر
${prodLines}`
}

function buildRosyPersonalityBlock(params: {
  intent: IntentName
  hasBookedBefore: boolean
  isFrequentChatter: boolean
  luxuryHint: boolean
  priceSensitive: boolean
}): string {
  const { intent, hasBookedBefore, isFrequentChatter, luxuryHint, priceSensitive } = params
  let s = `## شخصية روزي (إلزامي — مستوى مساعد ذكي)
- سعودية (لهجة بيضاء مفهومة)، دافئة، أنثوية، **قصيرة** — تفهمين السوق والسلانج (يالله، وش، ابغى، زين، يلا، حيل، ضبطي…).
- **افهمي كلام المستخدمة وتكلّمي بنفس الطابع**: ابغى، وش الأفضل، مره، حلو، تمام، زين، يا بعدي.
- أمثلة نبرة: "أكيد حبيبتي 💖"، "تمام يا الغالية"، "لقيت لك أفضل الخيارات 👇✨"
- **لا تعتذري** — لا تقلي «آسفة» أو «عذراً» أو «معذرة»؛ قدّمي بدلاً من ذلك **خطوة تالية مفيدة** (خريطة، بحث، خدمة مقترحة، أو سؤال واحد واضح).
- **استنتاجي**: اربطي بالمحادثة السابقة؛ لا تكرري سؤالاً إن الجواب ظاهر في التاريخ أو في ذاكرة المستخدمة.
- **مسار**: قصد المستخدمة → اقتراح واضح (أفضل 3) → تأكيد خفيف → دفع لطيف نحو الحجز.
- التصنيف الحالي للرسالة: **${intent}**.
- لا تعرضي JSON أو جداول؛ البطاقات تظهر في الواجهة — اكتفي بجملة قصيرة + إيموجي واحد أو اثنين كحد أقصى.
- بعد عرض خيارات الصالونات: وجّهي للحجز: "تحبي أحجز لكِ من هنا؟ 💕" أو "نكمّل الحجز؟ ✨"
- **إن لم تُجد صالونات مناسبة في البيانات**: قدّمي بديلاً فورياً — اقتراح مدينة/حي، أو «جرّبي البحث أو الخريطة من الأسفل»، أو خدمة شائعة (قص، أظافر، عناية) **بدون** اعتذار طويل.
`
  if (isFrequentChatter || hasBookedBefore) {
    s += `- مستخدمة واثقة مع التطبيق — **قلّلي الأسئلة** وقدّمي خيارات مباشرة.\n`
  }
  if (hasBookedBefore) {
    s += `- عندها حجوزات سابقة — رشّحي صالونات بذوق مشابه (نفس المدينة/التصنيف عند التوفر) أو زارتها سابقاً.\n`
  }
  if (luxuryHint) {
    s += `- يبدو تفضيل **فخم** — رجّحي الأعلى تقييماً والأكثر تميزاً في البيانات.\n`
  }
  if (priceSensitive) {
    s += `- حساسية للسعر — رجّحي خيارات منطقية وذكّري بأسعار الخدمات من البيانات عند الحاجة.\n`
  }
  s += `
## أسئلة ذكية (فقط عند الحاجة)
- إن لم تُعرف المدينة وطلبتِ توصية مكانية وليست في الملف: سؤال **واحد** مثل "تبغي الأقرب لك ولا الأعلى تقييم؟" — لا سلسلة أسئلة.
`
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const accessToken = auth.slice(7).trim()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'إعداد خادم Supabase ناقص' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  let userId: string
  try {
    const { data, error: authErr } = await authClient.auth.getUser(accessToken)
    if (authErr || !data?.user) {
      return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي (جلسة غير صالحة)' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    userId = data.user.id
  } catch {
    return new Response(JSON.stringify({ error: 'تعذر الاتصال بخدمة التحقق من الجلسة' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const userSb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  try {
    const body = (await req.json()) as {
      messages?: Msg[]
      imageBase64?: string
      imageMimeType?: string
      contextBlock?: string
      userLat?: number
      userLng?: number
      cartLineCount?: number
      cartTotalQty?: number
      checkoutRecentCartAdd?: boolean
      checkoutShortAffirm?: boolean
      checkoutUserTurnsWithCart?: number
      checkoutClickedFromRosy?: boolean
      salonOwnerSalesMode?: boolean
    }

    const historyMsgs = Array.isArray(body.messages) ? body.messages.filter((m) => m.role !== 'system').slice(-16) : []
    const legacyCtx = typeof body.contextBlock === 'string' && body.contextBlock.trim() ? body.contextBlock.trim() : ''

    const hasImage =
      typeof body.imageBase64 === 'string' &&
      body.imageBase64.length > 0 &&
      typeof body.imageMimeType === 'string' &&
      body.imageMimeType.length > 0

    const apiKey = readOpenAiApiKey()
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'لم يُعرّف مفتاح OpenAI. أضيفي OPENAI_API_KEY في Supabase → Edge Functions → Secrets (مفتاح من platform.openai.com، سطر واحد بدون اقتباسات).',
        }),
        { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const [
      { data: prof, error: pErr },
      { data: histRows, error: hErr },
      { data: skinRow, error: skErr },
      memoryPack,
      ownerB2bCtx,
      { data: toneStatsRows, error: toneStatsErr },
    ] = await Promise.all([
      userSb.from('profiles').select('id,full_name,city,preferred_language').eq('id', userId).maybeSingle(),
      userSb
        .from('chat_messages')
        .select('message,response,is_user,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(16),
      userSb
        .from('skin_analysis')
        .select('skin_type,issues,analysis_result,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchMemoryPack(userSb, userId),
      fetchSalonOwnerB2BContext(userSb, userId),
      userSb.rpc('rosey_hesitation_tone_stats', { p_days: 90 }),
    ])

    if (pErr) console.warn('[rozi-chat] profile', pErr.message)
    if (hErr) console.warn('[rozi-chat] history', hErr.message)
    if (skErr) console.warn('[rozi-chat] skin_analysis', skErr.message)
    if (toneStatsErr) console.warn('[rozi-chat] rosey_hesitation_tone_stats', toneStatsErr.message)

    const toneStatsParsed = parseToneStatsRows(toneStatsRows)

    const profile = (prof ?? { id: userId, full_name: null, city: null, preferred_language: 'ar' }) as ProfileRow
    const profileCity = (profile.city || 'الخبر').trim()
    const historyText = formatHistoryLines((histRows ?? []) as Parameters<typeof formatHistoryLines>[0])
    const skinBlock = formatSkinContextBlock((skinRow ?? null) as SkinContextRow | null)

    const utterance = lastUserText(historyMsgs, hasImage)

    const cartLineCount =
      typeof body.cartLineCount === 'number' && body.cartLineCount > 0 ? Math.floor(body.cartLineCount) : 0
    const cartTotalQty =
      typeof body.cartTotalQty === 'number' && body.cartTotalQty > 0 ? Math.floor(body.cartTotalQty) : 0
    const checkoutRecentCartAdd = body.checkoutRecentCartAdd === true
    const checkoutShortAffirm = body.checkoutShortAffirm === true
    const checkoutUserTurnsWithCart =
      typeof body.checkoutUserTurnsWithCart === 'number' ? Math.max(0, Math.floor(body.checkoutUserTurnsWithCart)) : 0
    const checkoutClickedFromRosy = body.checkoutClickedFromRosy === true
    const clientSalonOwnerSalesMode = body.salonOwnerSalesMode === true

    let intent: IntentName = 'general_question'
    let entities: Record<string, unknown> = {}

    try {
      const cls = await openaiJson<{ intent?: string; entities?: Record<string, unknown> }>(
        apiKey,
        `Classify for Rosera (Saudi women's beauty app). JSON only:
{"intent":"search_salon"|"recommend_service"|"booking_request"|"store_products"|"general_question","entities":{...}}

Intents:
- booking_request: أبغى أحجز، ابغى احجز، احجز، احجزي، موعد، نحجز، ابي احجز، reserve
- search_salon: وش الأفضل، وش احسن، وين صالون، أقرب، دوري لي، استكشاف، مقارنة صالونات، "وش تنصحين" (صالونات)
- recommend_service: تركيز على خدمة في صالون: أظافر، شعر، ليزر، سبا، مكياج…
- store_products: شراء منتجات من متجر التطبيق، نصيحة منتج، بشرتي جافة، أبغى ماسك، أفضل شامبو، تساقط شعر، عطر، مكياج للبيت، جهاز تجميل، وش أشتري من المتجر، منتجات عناية
- general_question: التطبيق، شكر، تحية، صورة غير واضحة، غير مصنف

entities (optional):
- query, service_keyword, salon_hint, city, date_hint (strings)
- store_categories: string[] — فئات عربية حرفياً من القائمة فقط: "عناية بالبشرة"|"مكياج"|"عناية بالشعر"|"عطور"|"أظافر"|"أجهزة تجميل"|"سبا"|"عناية بالجسم"
- budget_tier: "low"|"mid"|"high"|null — رخيص، أرخص، توفير، ميزانية، غالي، سعر، خصم → low
- urgency: "today"|"soon"|null — اليوم، الحين، الآن، عاجل، حالاً → today
- style: "luxury"|"budget"|null — فخم، VIP، لوكس → luxury
- browse_mode: boolean — true إن كانت تتصفح/تقارن فقط بدون نية حجز صريحة

افهمي السوق واللهجة الخفيفة (يالله، زين، يلا، نفس، ضبطي). If unsure: general_question + {}.`,
        `User message:\n${utterance.slice(0, 1200)}`
      )
      intent = normalizeIntent(cls.intent)
      entities = cls.entities && typeof cls.entities === 'object' ? cls.entities : {}
    } catch (e) {
      console.warn('[rozi-chat] classify fallback', e)
    }

    const serviceKeyword =
      typeof entities.service_keyword === 'string'
        ? entities.service_keyword
        : typeof entities.query === 'string' && intent === 'recommend_service'
          ? entities.query
          : ''

    const userLatRaw = typeof body.userLat === 'number' ? body.userLat : NaN
    const userLngRaw = typeof body.userLng === 'number' ? body.userLng : NaN
    const userLatLng =
      Number.isFinite(userLatRaw) && Number.isFinite(userLngRaw) ? { lat: userLatRaw, lng: userLngRaw } : null

    const luxuryHint =
      entities.style === 'luxury' || /فخم|فاخر|vip|لوكس|luxury/i.test(utterance)
    const priceSensitive =
      entities.budget_tier === 'low' ||
      /رخيص|أرخص|سعر|خصم|budget|غال[يى]|غالي|مبالغ/i.test(utterance)
    const urgentToday =
      entities.urgency === 'today' || /اليوم|الحين|الآن|عاجل|حالاً|اليوم$/i.test(utterance)

    const recoHistory = await fetchRecoHistory(userSb, userId)
    const hasBookedBefore = recoHistory.bookedBusinessIds.size > 0
    const isFrequentChatter = (histRows ?? []).length >= 8

    const salonsRaw = await fetchSalonsForUser(userSb, profileCity, intent, entities)
    const rankedSalons = partitionFeaturedSalonsFirst(
      rankSalonsForRosy(salonsRaw, recoHistory, userLatLng, {
        luxury: luxuryHint,
        priceSensitive,
        similarToBooked: hasBookedBefore,
        urgentToday,
        preferredPriceRange: memoryPack.preferredPriceRange,
      })
    )

    const emptyMetrics: SalonOwnerSalesMetrics = { impressions_7d: 0, clicks_7d: 0, bookings_7d: 0 }
    let salesMetrics = emptyMetrics
    let upsellStateRow: RosyUpsellStateRow | null = null
    if (ownerB2bCtx.is_owner && ownerB2bCtx.salon_id) {
      const sid = ownerB2bCtx.salon_id
      const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const fromDate = weekAgoIso.slice(0, 10)
      const VIEW_TYPES = new Set(['view', 'view_salon', 'ai_recommended_view'])
      const CLICK_TYPES = new Set(['click', 'booking_click', 'salon_clicks'])
      const [{ data: evs }, { count: bkCount }, { data: st, error: stErr }] = await Promise.all([
        userSb.from('user_events').select('event_type').eq('entity_type', 'business').eq('entity_id', sid).gte('created_at', weekAgoIso),
        userSb
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', sid)
          .gte('booking_date', fromDate)
          .in('status', ['pending', 'confirmed', 'completed']),
        userSb.from('rosey_subscription_upsell_state').select('last_cta_at, follow_up_at').eq('user_id', userId).maybeSingle(),
      ])
      if (stErr) console.warn('[rozi-chat] rosey_subscription_upsell_state', stErr.message)
      let impressions_7d = 0
      let clicks_7d = 0
      for (const row of evs ?? []) {
        const t = (row as { event_type?: string }).event_type
        if (t && VIEW_TYPES.has(t)) impressions_7d++
        else if (t && CLICK_TYPES.has(t)) clicks_7d++
      }
      salesMetrics = { impressions_7d, clicks_7d, bookings_7d: bkCount ?? 0 }
      upsellStateRow = stErr ? null : ((st as RosyUpsellStateRow | null) ?? null)
    }

    let hadClickSinceLastCta = false
    if (upsellStateRow?.last_cta_at) {
      const { data: clk } = await userSb
        .from('user_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'rosy_salon_subscription_upsell_click')
        .gte('created_at', upsellStateRow.last_cta_at)
        .limit(1)
        .maybeSingle()
      hadClickSinceLastCta = !!clk
    }

    const upsellDecision = computeSalonSubscriptionUpsellDecision(
      ownerB2bCtx,
      salesMetrics,
      rankedSalons,
      utterance,
      upsellStateRow,
      hadClickSinceLastCta
    )

    const businessIds = rankedSalons.map((s) => s.id)
    const services = await fetchServices(userSb, businessIds, serviceKeyword || undefined)
    const products = await fetchProducts(userSb)
    const skinPayload = skinPayloadFromRow((skinRow ?? null) as SkinContextRow | null)

    const storeCats = resolveStoreCategories(entities, utterance, intent)
    const hasProductCategory =
      storeCats.length > 0 || pickPrimaryStoreCategory(entities, utterance) != null
    const shouldFetchStore =
      hasProductCategory &&
      (intent === 'store_products' ||
        ((intent === 'general_question' || intent === 'recommend_service') && !utteranceSalonHeavy(utterance)))
    const uncertainProducts = isUncertainStoreIntent(entities)
    const productLimit = uncertainProducts ? 2 : 3
    const productPicks = shouldFetchStore
      ? await fetchProductsForStoreRecommendations(userSb, entities, utterance, intent, skinPayload, recoHistory, productLimit)
      : []
    const storeProductBlock = buildStoreProductBrainBlock(
      productPicks,
      skinPayload,
      memoryPack.narrative,
      productLimit === 2 ? 2 : 3
    )

    const qtyForCartBrain = cartTotalQty > 0 ? cartTotalQty : cartLineCount
    const hesitationMode =
      cartLineCount > 0 &&
      !hasImage &&
      !ownerB2bCtx.is_owner &&
      !clientSalonOwnerSalesMode &&
      !checkoutClickedFromRosy &&
      checkoutUserTurnsWithCart >= 2
    const shouldOfferCheckout =
      cartLineCount > 0 &&
      !hasImage &&
      !ownerB2bCtx.is_owner &&
      !clientSalonOwnerSalesMode &&
      !checkoutClickedFromRosy &&
      (checkoutRecentCartAdd || checkoutShortAffirm || checkoutUserTurnsWithCart >= 2)

    const hesitationAdaptive = hesitationMode
      ? pickHesitationToneAdaptive(checkoutUserTurnsWithCart, toneStatsParsed)
      : { tone: 0 as 0 | 1 | 2, source: 'rotation' as const }
    const hesitationTone = hesitationAdaptive.tone
    const hesitationToneSource = hesitationMode ? hesitationAdaptive.source : 'rotation'

    const cartContextBlock = buildCartContextBlockForBrain(
      cartLineCount,
      qtyForCartBrain,
      shouldOfferCheckout,
      hesitationMode,
      hesitationTone
    )

    const tokens = skinTokensFromPayload(skinPayload)
    const rankedSvc = rankServices(services as ServiceForRank[], skinPayload, tokens, recoHistory, 10)
    const rankedProd = rankProducts(products as ProductForRank[], skinPayload, tokens, recoHistory, 8)
    const rankedServicesLines = rankedSvc
      .map(
        (x) =>
          `- [${x.item.id}] (نقاط ${x.score}) ${x.item.name_ar} — صالون ${x.item.business_id} — أسباب: ${x.reasons.join('؛ ')}`
      )
      .join('\n')
    const rankedProductsLines = rankedProd
      .map((x) => `- [${x.item.id}] (نقاط ${x.score}) ${x.item.name_ar} — أسباب: ${x.reasons.join('؛ ')}`)
      .join('\n')

    const brainContext = buildBrainContext({
      memoryNarrative: memoryPack.narrative,
      profile,
      historyText,
      salons: rankedSalons,
      services,
      products,
      skinBlock,
      rankedServicesLines,
      rankedProductsLines,
      storeProductBlock,
      cartContextBlock: cartContextBlock || undefined,
    })

    let negotiationExtraSystem = ''
    let negotiationReplyPrefix = ''
    let negotiationActions: RozyActionOut[] = []
    if (utteranceWantsPriceNegotiation(utterance) && rankedSalons.length > 0) {
      const fid = pickFocusSalonIdForNegotiation(rankedSalons, entities)
      const focusSalon = fid ? rankedSalons.find((s) => s.id === fid) ?? null : null
      if (focusSalon) {
        const pack = buildPriceNegotiationPack(focusSalon, services, rankedSalons)
        negotiationExtraSystem = `\n\n${pack.systemAppendix}`
        negotiationReplyPrefix = pack.replyPrefix
        negotiationActions = pack.actions
      }
    }

    const extraLegacy = legacyCtx ? `\n\n## سياق إضافي من العميل (قديم — اختياري)\n${legacyCtx}` : ''

    const personality = buildRosyPersonalityBlock({
      intent,
      hasBookedBefore,
      isFrequentChatter,
      luxuryHint,
      priceSensitive,
    })

    const premiumTop = rankedSalons[0]?.subscription_plan === 'premium'
    const premiumSalonHint = premiumTop
      ? `

## تمييز الصالونات (B2B)
- أول صالون في قائمة «صالونات وعيادات» أعلاه ضمن خطة **Premium**. عند التوصية به مباشرة، يمكنكِ **مرة واحدة** جملة مثل: «هذا من أفضل الصالونات المميزة ⭐» مع اسم الصالون، ثم تكملي النصائح والحجز كالمعتاد.`
      : ''

    const salonSalesAppendix = buildSalonOwnerSubscriptionSalesSystemAppendix(ownerB2bCtx, rankedSalons, upsellDecision)

    const systemMain = `${personality}${premiumSalonHint}${salonSalesAppendix}

## مهمتكِ التنفيذية
- اعتمدي فقط على **البيانات الحقيقية** في القسم التالي لذكر صالون/خدمة/منتج (معرفات [uuid] للحجز: /salon/{id} ثم /booking/{id}).
- **ممنوع الاعتذار** — كل رد يجب أن يتضمّن توصية أو اقتراحاً قابلاً للتنفيذ.
- شجّعي على الحجز بلطف عند المناسب.
- منتجات المتجر: /store و /product/{id} — إن وُجد قسم "منتجات متجر روزيرا (مُختارة)" فالزمي الأسماء والأسعار والفوائد منه فقط.
- صورة الوجه: تحليل مختصر — **ليس تشخيصاً طبياً** — ولا تطلبي حفظ الصور.
- قسم تحليل البشرة والتوصيات المرتبة: استخدميهما عند الصلة دون إطالة.

## بيانات حقيقية (Supabase)
${brainContext}
${extraLegacy}

## ممنوع
- اختلاق أسماء أو أسعار غير موجودة في البيانات.
- إظهار أخطاء تقنية أو تفاصيل خوادم.
- الإنجليزية في الرد (ما عدا uuid).${negotiationExtraSystem}`

    const messagesForApi: OpenAIChatMessage[] = [{ role: 'system', content: systemMain }]

    for (const m of historyMsgs) {
      if (m.role === 'user' || m.role === 'assistant') {
        messagesForApi.push({ role: m.role, content: m.content })
      }
    }

    if (hasImage) {
      const dataUrl = `data:${body.imageMimeType};base64,${body.imageBase64}`
      let patched = false
      for (let i = messagesForApi.length - 1; i >= 0; i--) {
        if (messagesForApi[i].role === 'user') {
          const prev = messagesForApi[i].content
          const text = typeof prev === 'string' ? prev : ''
          messagesForApi[i] = {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }
          patched = true
          break
        }
      }
      if (!patched) {
        messagesForApi.push({
          role: 'user',
          content: [
            { type: 'text', text: 'تحليل صورة الوجه للبشرة والعلاجات المقترحة (بدون حفظ الصورة)' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        })
      }
    }

    let reply = await openaiComplete(apiKey, messagesForApi, 1200)

    if (negotiationReplyPrefix) {
      reply = `${negotiationReplyPrefix}${reply}`
    }

    if (productPicks.length > 0) {
      reply = appendProductConversionLines(reply)
    }

    if (shouldOfferCheckout) {
      reply = hesitationMode
        ? appendHesitationCheckoutLines(reply, hesitationTone, cartLineCount)
        : appendCheckoutConversionLines(reply, cartLineCount)
    }

    const hideSalonsForStoreProducts =
      productPicks.length > 0 &&
      (intent === 'store_products' || (intent === 'general_question' && !utteranceSalonHeavy(utterance)))

    if (shouldIncludeSalonCards(intent, utterance) && rankedSalons.length === 0 && !hideSalonsForStoreProducts) {
      reply = `ما لقيت شيء مناسب 😢\nخليني أوريك الأقرب لك\n\n${reply}`
    }

    let salonsOut: RozySalonOut[] = []
    let actionsOut: RozyActionOut[] = []
    if (
      !hideSalonsForStoreProducts &&
      shouldIncludeSalonCards(intent, utterance) &&
      rankedSalons.length > 0
    ) {
      salonsOut = salonsToPayload(rankedSalons, userLatLng)
      actionsOut = buildActionsForSalons(salonsOut)
    }
    const subscriptionUpsell = upsellDecision.showCta
    if (subscriptionUpsell) {
      actionsOut = [
        ...actionsOut,
        { id: 'rosy-salon-sub-upgrade', label: 'تفعيل الآن', kind: 'salon_upgrade' },
      ]
    }
    if (negotiationActions.length) {
      actionsOut = [...actionsOut, ...negotiationActions]
    }
    if (productPicks.length > 0) {
      actionsOut = [...actionsOut, ...buildProductConversionActions(productPicks)]
      actionsOut.push({ id: 'rozy-open-store', label: 'تصفحي المتجر', kind: 'store' })
    }
    if (shouldOfferCheckout && !actionsOut.some((a) => a.kind === 'go_to_checkout')) {
      actionsOut = [
        ...actionsOut,
        { id: 'rozy-go-checkout', label: 'إتمام الطلب', kind: 'go_to_checkout' },
      ]
    }
    if (urgentToday && salonsOut.length > 0) {
      reply = `في مواعيد اليوم متاحة 🔥\n\n${reply}`
    }

    let bookingAction: {
      action: 'booking'
      salon_id: string | null
      service_id: string | null
      booking_date: string | null
      suggested_slots: string[]
    } | null = null

    if (intent === 'booking_request') {
      const salonCatalog = rankedSalons.map((s) => ({ id: s.id, name: s.name_ar })).slice(0, 20)
      const svcCatalog = services.map((s) => ({ id: s.id, business_id: s.business_id, name: s.name_ar })).slice(0, 30)
      try {
        const extracted = await openaiJson<BookingExtract>(
          apiKey,
          `Extract booking fields as JSON only: {"salon_id":string|null,"service_id":string|null,"booking_date":"YYYY-MM-DD"|null}
Rules:
- salon_id and service_id MUST be copied exactly from the catalog UUIDs if mentioned; otherwise null.
- booking_date: normalize Arabic dates to ISO date (assume Asia/Riyadh today context if year missing — use next occurrence).
- If unsure, use null.`,
          `Catalog salons: ${JSON.stringify(salonCatalog)}
Catalog services: ${JSON.stringify(svcCatalog)}
Recent conversation (last user + assistant):\n${utterance}\n---\nAssistant draft reply:\n${reply.slice(0, 800)}`,
          300
        )

        const sid = extracted.salon_id && rankedSalons.some((s) => s.id === extracted.salon_id) ? extracted.salon_id : null
        let svcId = extracted.service_id && services.some((s) => s.id === extracted.service_id) ? extracted.service_id : null
        if (svcId && sid && services.find((s) => s.id === svcId)?.business_id !== sid) {
          svcId = null
        }
        const dateOk = extracted.booking_date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.booking_date) ? extracted.booking_date : null

        const salonForSlots = sid ? rankedSalons.find((s) => s.id === sid) : null
        const slots = salonForSlots ? pickSlotsFromOpeningHours(salonForSlots.opening_hours) : defaultSlots()

        if (sid) {
          bookingAction = {
            action: 'booking',
            salon_id: sid,
            service_id: svcId,
            booking_date: dateOk,
            suggested_slots: slots,
          }
        }
      } catch (e) {
        console.warn('[rozi-chat] booking extract', e)
      }
    }

    if (upsellDecision.showCta && upsellDecision.rpcMode) {
      void userSb.rpc('mark_rosey_subscription_upsell_shown', { p_mode: upsellDecision.rpcMode }).then(
        () => {},
        (e) => console.warn('[rozi-chat] mark_rosey_subscription_upsell_shown', e)
      )
    }

    const brainIntent =
      productPicks.length > 0 && intent === 'general_question' ? ('store_products' as IntentName) : intent

    return new Response(
      JSON.stringify({
        reply,
        brain: {
          intent: brainIntent,
          entities: {
            ...entities,
            store_categories: storeCats,
            store_product_ids: productPicks.map((p) => p.id),
            store_intent_uncertain: uncertainProducts,
            store_product_limit: productPicks.length > 0 ? productLimit : null,
            checkout_nudge: shouldOfferCheckout,
            checkout_hesitation: hesitationMode,
            checkout_hesitation_tone: hesitationMode
              ? (['direct', 'soft', 'choice'] as const)[hesitationTone]
              : null,
            checkout_hesitation_tone_source: hesitationMode ? hesitationToneSource : null,
            cart_line_count: cartLineCount,
            cart_total_qty: cartLineCount > 0 ? qtyForCartBrain : null,
            rosy_price_negotiation: Boolean(negotiationExtraSystem),
          },
          salon_subscription_pitch: subscriptionUpsell,
          salon_subscription_pitch_follow_up: upsellDecision.followUpMode,
          salon_owner_metrics_7d: {
            impressions: salesMetrics.impressions_7d,
            clicks: salesMetrics.clicks_7d,
            bookings: salesMetrics.bookings_7d,
          },
        },
        action: bookingAction,
        salons: salonsOut,
        products: productPicks,
        actions: actionsOut,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('[rozi-chat] unhandled', e)
    return new Response(
      JSON.stringify({
        reply:
          'لحظة يا حلوة… صار عندي بطء بسيط 💕 جرّبي تكتبين رسالتك مرة ثانية، وإن بقيت المشكلة رجعي بعد شوي.',
        brain: { intent: 'general_question' as IntentName, entities: {} },
        action: null,
        salons: [],
        products: [],
        actions: [
          { id: 'retry_soft', label: 'جرّبي مرة ثانية', kind: 'retry' },
          { id: 'more_options', label: 'شوفي خيارات ثانية', kind: 'more' },
        ],
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
