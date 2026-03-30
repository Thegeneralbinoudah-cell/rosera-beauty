import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getEdgeFunctionErrorMessage, getEdgeFunctionHttpErrorDetail } from '@/lib/edgeInvoke'
import type {
  RozyChatAction,
  RozyProductCard,
  RozyRecommendationMode,
  RozySalonCard,
} from '@/lib/roseyChatTypes'
import {
  buildRosyWelcomeFromMemoryAndSignals,
  fetchRosyWelcomeContext,
  getRecommendedSalons,
  topRosyServiceFromPreferenceSignals,
  type RecommendSort,
  type SalonWithRecommendMeta,
} from '@/lib/aiRanking'
import {
  ROSY_BOOKING_ASSISTANT_WELCOME,
  ROSY_FIRST_VISIT_WELCOME,
  ROSY_OWNER_SALES_CHAT_WELCOME,
  ROSY_OWNER_VOICE_SALES_INTRO,
  ROSY_OWNER_VOICE_SUBSCRIPTION_NAV,
} from '@/lib/roseyChatCopy'
import { requestBrowserGeolocation, type RosyServiceType } from '@/lib/roseySalonSuggestions'
import { normalizeArabic } from '@/lib/normalizeArabic'
import { playRosyVoice, stopRosyVoicePlayback } from '@/lib/voice'
import { trackEvent } from '@/lib/analytics'
import { captureProductEvent } from '@/lib/posthog'
import { rememberRosyHesitationToneForCheckout } from '@/lib/roseyHesitationAnalytics'
import { useCartStore } from '@/stores/cartStore'
import { ensureUserProfile } from '@/lib/ensureUserProfile'
import { STORAGE_KEYS } from '@/lib/utils'
import { fetchRosySalonBookingPreview } from '@/lib/roseySalonBookingPreview'
import { invokeRozyAdvisor, VISION_FAIL_AR } from '@/lib/rozyVisionChatInvoke'
import type { RozyVisionChatResult, RozyVisionChatAdvisorMode } from '@/lib/rozyVisionChatTypes'

const ROSY_PREMIUM_TOP_LINE = 'هذا من أفضل الصالونات المميزة\n'

/** رد مساعد — بدون نص الرسالة؛ source يحدد المسار (نموذج/حافة/صوت). */
function captureRosyReplyGenerated(
  source: string,
  extra?: { intent?: string | null; had_error?: boolean }
) {
  captureProductEvent('rosy_reply_generated', {
    source: source.slice(0, 64),
    ...(extra?.intent ? { intent: String(extra.intent).slice(0, 80) } : {}),
    ...(typeof extra?.had_error === 'boolean' ? { had_error: extra.had_error } : {}),
  })
}

function logChatInsertError(label: string, err: PostgrestError) {
  console.error(`Chat insert error (${label}):`, {
    message: err.message,
    details: err.details,
    code: err.code,
    hint: err.hint,
  })
}

/** يضمن وجود صف في profiles قبل chat_messages (FK). يتطلب سياسة INSERT في migration 051. */
async function ensureProfileRow(user: User): Promise<boolean> {
  return ensureUserProfile(user)
}

/** Shown before capture, after results, and appended to stored assistant text for image analysis. */
export const FACE_SCAN_MEDICAL_DISCLAIMER =
  '⚠️ تنبيه مهم: هذه التوصيات للمساعدة فقط ولا تغني عن\nاستشارة الطبيب المختص. يُرجى مراجعة طبيب متخصص قبل\nاتخاذ أي قرار علاجي.'

export const FACE_SCAN_CONSENT_LABEL =
  'أوافق على أن هذه التوصيات للمساعدة فقط وليست تشخيصاً طبياً'

export function appendMedicalDisclaimerToReply(reply: string): string {
  const t = reply.trim()
  if (!t) return FACE_SCAN_MEDICAL_DISCLAIMER
  if (t.includes(FACE_SCAN_MEDICAL_DISCLAIMER)) return t
  return `${t}\n\n${FACE_SCAN_MEDICAL_DISCLAIMER}`
}

/** مفتاح كيان محفوظ في `chat_messages.rosey_entities` لنتيجة تحليل المستشار. */
export const ROZY_VISION_ADVISOR_ENTITY_KEY = 'rozy_vision_advisor_v1'

export type { RozyRecommendationMode } from '@/lib/roseyChatTypes'

const ROZY_RECOMMENDATION_MODES: ReadonlySet<string> = new Set([
  'none',
  'salon',
  'product',
  'mixed',
  'booking',
])

export const ROSEY_ENTITY_RECOMMENDATION_MODE_KEY = 'recommendation_mode' as const

/** نسخة مضغوطة من `meta` الـ Edge تُحفظ في `rosey_entities` للتدقيق وإصدارات لاحقة */
export const ROSEY_ENTITY_RESPONSE_META_KEY = 'rosey_response_meta' as const

function parseRecommendationMode(raw: unknown): RozyRecommendationMode | undefined {
  if (typeof raw !== 'string' || !ROZY_RECOMMENDATION_MODES.has(raw)) return undefined
  return raw as RozyRecommendationMode
}

export type ChatRow = {
  id: string
  message: string
  is_user: boolean
  created_at: string
  salons?: RozySalonCard[]
  products?: RozyProductCard[]
  actions?: RozyChatAction[]
  /** من `rozi-chat` meta أو استنتاج من البطاقات — لترتيب العرض وتمييز الحجز */
  recommendationMode?: RozyRecommendationMode
  /** من `rosey_action` عند استرجاع السجل أو من رد Edge مباشرة */
  bookingAction?: RoziBookingAction | null
  /** نتيجة `invokeRozyAdvisor` — للعرض الغني في واجهة المحادثة فقط */
  visionAdvisorResult?: RozyVisionChatResult
}

export type RoziBookingAction = {
  action: 'booking'
  salon_id: string
  service_id?: string | null
  booking_date?: string | null
  suggested_slots?: string[]
}

/** استنتاج الوضع عند غياب `meta.recommendation_mode` المخزّن — يحترم `booking` إن وُجد */
function inferRecommendationMode(
  salons: RozySalonCard[] | undefined,
  products: RozyProductCard[] | undefined,
  booking: RoziBookingAction | null | undefined
): RozyRecommendationMode {
  if (booking && booking.action === 'booking' && booking.salon_id) return 'booking'
  const sc = salons?.length ?? 0
  const pc = products?.length ?? 0
  if (sc > 0 && pc > 0) return 'mixed'
  if (sc > 0) return 'salon'
  if (pc > 0) return 'product'
  return 'none'
}

/** يستعيد حجزاً من عمود `rosey_action` أو يعيد null إن البيانات ناقصة/قديمة */
function parseRoziBookingAction(raw: unknown): RoziBookingAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.action !== 'booking') return null
  const salon_id = typeof o.salon_id === 'string' ? o.salon_id.trim() : ''
  if (!salon_id) return null
  const slotsRaw = o.suggested_slots
  const suggested_slots = Array.isArray(slotsRaw)
    ? (slotsRaw as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined
  const bd = o.booking_date
  const booking_date =
    typeof bd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bd) ? bd : null
  const sid = o.service_id
  return {
    action: 'booking',
    salon_id,
    service_id: typeof sid === 'string' && sid.trim() ? sid : null,
    booking_date,
    suggested_slots: suggested_slots?.length ? suggested_slots : undefined,
  }
}

/**
 * دمج `recommendation_mode` المخزّن مع حجز من `rosey_action` — الحجز الصالح يتقدّم على أي قيمة مخزّنة.
 */
function resolveRecommendationModeForRow(params: {
  stored: RozyRecommendationMode | undefined
  booking: RoziBookingAction | null
  salons: RozySalonCard[] | undefined
  products: RozyProductCard[] | undefined
}): RozyRecommendationMode {
  const { stored, booking, salons, products } = params
  if (booking && booking.action === 'booking' && booking.salon_id) return 'booking'
  const hasCards = (salons?.length ?? 0) > 0 || (products?.length ?? 0) > 0
  if (stored !== undefined) {
    if (stored === 'none' && hasCards) {
      return inferRecommendationMode(salons, products, null)
    }
    return stored
  }
  return inferRecommendationMode(salons, products, null)
}

export type RoziBrainPayload = {
  meta?: {
    schema_version?: number
    ok?: boolean
    recommendation_mode?: string
    code?: string
  }
  reply?: string
  error?: string
  brain?: {
    intent: string
    entities: Record<string, unknown>
    salon_subscription_pitch?: boolean
    salon_subscription_pitch_follow_up?: boolean
    salon_owner_metrics_7d?: { impressions: number; clicks: number; bookings: number }
  }
  action?: RoziBookingAction | null
  salons?: RozySalonCard[]
  products?: RozyProductCard[]
  actions?: RozyChatAction[]
}

function compactResponseMeta(meta: RoziBrainPayload['meta']): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const out: Record<string, unknown> = {}
  if (typeof meta.schema_version === 'number' && Number.isFinite(meta.schema_version)) {
    out.schema_version = meta.schema_version
  }
  if (typeof meta.ok === 'boolean') out.ok = meta.ok
  if (typeof meta.code === 'string' && meta.code.trim()) {
    out.code = meta.code.trim().slice(0, 80)
  }
  return Object.keys(out).length ? out : undefined
}

function parseProductCards(raw: unknown): RozyProductCard[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: RozyProductCard[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!id) continue
    const priceRaw = o.price
    const price =
      typeof priceRaw === 'number' && Number.isFinite(priceRaw)
        ? priceRaw
        : typeof priceRaw === 'string' && priceRaw.trim()
          ? Number(priceRaw)
          : NaN
    if (!Number.isFinite(price)) continue
    const name_ar = typeof o.name_ar === 'string' ? o.name_ar : ''
    const benefit = typeof o.benefit === 'string' ? o.benefit : 'منتج من متجر روزيرا.'
    out.push({
      id,
      name_ar: name_ar || 'منتج',
      price,
      benefit,
      image_url: typeof o.image_url === 'string' ? o.image_url : null,
      brand_ar: typeof o.brand_ar === 'string' ? o.brand_ar : null,
      category: typeof o.category === 'string' ? o.category : null,
    })
  }
  return out.length ? out : undefined
}

function parseSalonCards(raw: unknown): RozySalonCard[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: RozySalonCard[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!id) continue
    out.push({
      id,
      name_ar: typeof o.name_ar === 'string' ? o.name_ar : '',
      average_rating: typeof o.average_rating === 'number' ? o.average_rating : null,
      distance_km: typeof o.distance_km === 'number' ? o.distance_km : null,
      cover_image: typeof o.cover_image === 'string' ? o.cover_image : null,
      google_photo_resource: typeof o.google_photo_resource === 'string' ? o.google_photo_resource : null,
    })
  }
  return out.length ? out : undefined
}

function parseChatActions(raw: unknown): RozyChatAction[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: RozyChatAction[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const label = typeof o.label === 'string' ? o.label : ''
    if (!id || !label) continue
    const kind = typeof o.kind === 'string' ? (o.kind as RozyChatAction['kind']) : undefined
    const salon_id = typeof o.salon_id === 'string' ? o.salon_id : null
    const service_id = typeof o.service_id === 'string' ? o.service_id : null
    const dp = o.discount_percent
    const discount_percent =
      typeof dp === 'number' && Number.isFinite(dp) ? dp : typeof dp === 'string' && dp.trim() ? Number(dp) : null
    const product_id = typeof o.product_id === 'string' ? o.product_id : null
    const product_name_ar = typeof o.product_name_ar === 'string' ? o.product_name_ar : null
    const product_image_url = typeof o.product_image_url === 'string' ? o.product_image_url : null
    const product_brand_ar = typeof o.product_brand_ar === 'string' ? o.product_brand_ar : null
    const pp = o.product_price
    const product_price =
      typeof pp === 'number' && Number.isFinite(pp) ? pp : typeof pp === 'string' && pp.trim() ? Number(pp) : null
    out.push({
      id,
      label,
      salon_id,
      kind,
      service_id,
      discount_percent: discount_percent != null && Number.isFinite(discount_percent) ? discount_percent : null,
      product_id,
      product_name_ar,
      product_price: product_price != null && Number.isFinite(product_price) ? product_price : null,
      product_image_url,
      product_brand_ar,
    })
  }
  return out.length ? out : undefined
}

export type UseChatOptions = {
  /** When Edge returns a structured booking action, e.g. navigate to `/booking/:salonId`. */
  onBookingAction?: (action: RoziBookingAction) => void
  /** مالكة صالون (portal أو دور owner/salon_owner): وضع مبيعات + صوت روزي الناعم + «اي/تمام» → اشتراك */
  salonOwnerSalesMode?: boolean
  /** بعد تأكيد صوتي للاشتراك — يُستدعى من AiChat للتوجيه */
  onSalonOwnerSubscriptionIntent?: () => void
}

type ApiMsg = { role: 'user' | 'assistant'; content: string }

export type RozySendMessageOptions = {
  /** رد صوتي عبر ElevenLabs/المتصفح بعد رد المساعد */
  fromVoice?: boolean
  /**
   * مع صورة: يتجاوز rozi-chat ويستدعي `rozi-vision` أوضاع المستشار فقط.
   */
  visionAdvisorMode?: RozyVisionChatAdvisorMode
}

/** رسائل قصيرة توافق على إضافة أول منتج مُقترَح من آخر رد لروزي */
function isRosyAffirmTopProductPhrase(normalized: string): boolean {
  const t = normalized.trim()
  if (!t) return false
  if (/^ضيفي[هة]?\s*$/i.test(t)) return true
  if (/^خلاص\s*خذي[هة]?\s*$/i.test(t)) return true
  if (/^تمام\s*$/i.test(t)) return true
  return false
}

/** ردود قصيرة تُستخدم مع سلة غير فارغة لدفع نحو checkout */
function isRosyCheckoutShortAffirm(normalized: string): boolean {
  const t = normalized.trim()
  if (!t || t.length > 18) return false
  return /^(تمام|تم|اوكي|اوك|اوكيه|ايه|اي|نعم|طيب|يس|زين|ok|yes)\s*$/i.test(t)
}

function isVoiceBookingKickoff(normalized: string): boolean {
  const t = normalized.trim()
  if (/^احجز(\s*لي)?$/i.test(t)) return true
  if (/^أريد\s+احجز/i.test(t)) return true
  if (/^أريد\s+أحجز/i.test(t)) return true
  if (/احجز\s+لي/i.test(t)) return true
  return false
}

function detectVoiceBookingPreference(normalized: string): 'near' | 'rating' | null {
  if (/أقرب|القريب|قريب|المسافة|قريب\s*مني|جنبي/i.test(normalized)) return 'near'
  if (/تقييم|أعلى|الأفضل|افضل|احسن|أحسن|جودة|نجوم/i.test(normalized)) return 'rating'
  return null
}

/** تأكيد صوتي لعرض الاشتراك (مالكة الصالون) */
function isVoiceSalonSubscriptionAffirm(normalized: string): boolean {
  const t = normalized.trim()
  if (!t) return false
  if (/^(اي|ايه|آيه|نعم|تمام|أكيد|اكيد|يلا|يلّا|تم|هلا|اوكي|اوك|ok|yes)\s*$/i.test(t)) return true
  if (/^(اي|ايه|آيه)[!.،\s]*$/i.test(t)) return true
  if (/^ا+ي+[!.،\s]*$/i.test(t)) return true
  return false
}

/**
 * TTS بعد كل رد مساعد — تأخير بسيط حتى يجهز الواجهة.
 * لا يعتمد على `fromVoice`: الصوت يُشغَّل دائماً عند وجود نص كافٍ.
 */
function scheduleAssistantTts(responseText: string, voiceMode?: 'salon_owner_sales') {
  setTimeout(() => {
    void (async () => {
      const text = responseText
      if (!text || text.trim().length < 2) {
        console.warn('⚠️ Empty or short text, skipping TTS')
        return
      }
      try {
        const r = await playRosyVoice(text, voiceMode ? { mode: voiceMode } : undefined)
        if (!r.ok && r.error) console.warn('[Rosy voice TTS]', r.error)
      } catch (e) {
        console.error('[Rosy voice]', e)
      }
    })()
  }, 100)
}

/** أسطر الترحيب — تُصدَّر من `roseyChatCopy` للتوافق مع الاستيرادات القديمة */
export {
  ROSY_BOOKING_ASSISTANT_TITLE,
  ROSY_BOOKING_ASSISTANT_SUBTITLE,
  ROSY_BOOKING_ASSISTANT_WELCOME,
} from '@/lib/roseyChatCopy'

/**
 * كلمات مفتاحية + ذاكرة التفضيلات: إن لم تذكري نوع الخدمة لكن عندنا سجل سلوك، نفلتر تلقائياً.
 */
function detectRosyRankFromMessage(
  msg: string,
  memoryService: RosyServiceType | null
): { sort: RecommendSort; serviceType: RosyServiceType | null } | null {
  const t = msg
  const urgent = /اليوم|الحين|الآن|عاجل|حالاً|بسرعة|مستعجل|السريع/i.test(t)
  const cheap =
    /رخيص|أرخص|سعر|خصم|ميزانية|توفير|econom|بلاش|مناسب\s*بالسعر|ارخص|غال[يى]|غالي|ابي\s*خصم|أبي\s*خصم/i.test(
      t
    )
  const wantsBook =
    /أبغى\s*أحجز|ابغى\s*احجز|ابغا\s*احجز|أحجز|احجزي|نحجز|ابي\s*احجز|ابغى\s*موعد|موعد\s*عند/i.test(t)
  const browsing = /وش\s*الأفضل|وش\s*احسن|وش\s*تنصح|شنو\s*الأفضل|مين\s*أحسن|أفضل\s*صالون|نصايح/i.test(t)

  /** طلب صريح لصالون بدون ذكر خدمة — يشغّل الاقتراح حتى من غير ذاكرة تفضيل */
  const genericSalonAsk =
    /ابي\s*صالون|أبي\s*صالون|ابغى\s*صالون|أبغى\s*صالون|ابغي\s*صالون|أبغي\s*صالون|دلّيني\s*صالون|دليني\s*صالون|ورّيني\s*صالون|وريني\s*صالون/i.test(
      t
    )

  const hasNear = t.includes('قريب') || urgent
  const explicitBest = t.includes('أفضل') || t.includes('أحسن') || browsing
  const hasNails = t.includes('أظافر')
  const hasHair = t.includes('شعر')
  const hasLaser = t.includes('ليزر')
  const vagueSalon =
    (/صالون|حجز|موعد|أبغى|ابغى|ابغا|دلّيني|دليني|وين|وش\s*تنصح|اقتراح|خيار|مكان|دوري\s*لي|ساعديني|دلّوني/.test(
      t
    ) ||
      wantsBook) &&
    !hasNails &&
    !hasHair &&
    !hasLaser

  if (
    !hasNear &&
    !explicitBest &&
    !cheap &&
    !hasNails &&
    !hasHair &&
    !hasLaser &&
    !(vagueSalon && memoryService) &&
    !genericSalonAsk
  )
    return null

  let sort: RecommendSort = 'ai'
  if (hasNear) sort = 'distance'
  else if (explicitBest) sort = 'rating'
  else if (cheap) sort = 'ai'

  let serviceType: RosyServiceType | null = null
  if (hasNails) serviceType = 'nails'
  else if (hasHair) serviceType = 'hair'
  else if (hasLaser) serviceType = 'laser'
  else if (vagueSalon && memoryService) serviceType = memoryService

  return { sort, serviceType }
}

function salonMetaToCard(s: SalonWithRecommendMeta): RozySalonCard {
  return {
    id: s.id,
    name_ar: s.name_ar,
    average_rating: s.average_rating != null ? Number(s.average_rating) : null,
    distance_km: s.distance_km,
    cover_image: s.cover_image ?? null,
    google_photo_resource: s.google_photo_resource ?? null,
  }
}

/** When Edge returns no reply — always actionable (salons / map / more), never empty apology. */
async function buildActionableFallbackRow(
  uid: string,
  clientGeo: { lat: number; lng: number } | null | undefined
): Promise<ChatRow> {
  try {
    const allSalons = await getRecommendedSalons(uid, {
      sort: 'rating',
      serviceType: null,
      userLocation: clientGeo ?? null,
      limit: 3,
    })
    const salons = allSalons.slice(0, 3)
    const previewBySalon = await fetchRosySalonBookingPreview(salons.map((s) => s.id))
    const topFirst = salons[0] != null ? previewBySalon.get(salons[0].id) : null
    const topServiceId = topFirst?.firstServiceId ?? null

    if (salons.length === 0) {
      return {
        id: crypto.randomUUID(),
        message:
          'اختاري من الخريطة أو البحث، أو اكتبي لي المدينة ونوع الخدمة — أنا أرشّح لكِ الأنسب.',
        is_user: false,
        created_at: new Date().toISOString(),
        actions: [
          { id: 'fb-map', label: 'خريطة الصالونات', kind: 'map' },
          { id: 'fb-more', label: 'اقتراحات أخرى', kind: 'more' },
        ],
      }
    }
    if (salons.length === 1) {
      return {
        id: crypto.randomUUID(),
        message: `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}هذا خيار قوي الآن.\nتحبي نكمّل الحجز؟`,
        is_user: false,
        created_at: new Date().toISOString(),
        actions: [
          { id: 'fb-b1', label: 'احجز الآن', kind: 'book', salon_id: salons[0].id, service_id: topServiceId },
          {
            id: 'fb-d1',
            label: 'عرض التفاصيل',
            kind: 'salon_detail',
            salon_id: salons[0].id,
            service_id: topServiceId,
          },
          { id: 'fb-map', label: 'الخريطة', kind: 'map' },
        ],
      }
    }
    const cards = salons.map(salonMetaToCard)
    return {
      id: crypto.randomUUID(),
      message: `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}هذه صالونات مقترحة حسب التوفر الحالي. اختاري ما يناسبك أو صفّي طلبك بشكل أدق.`,
      is_user: false,
      created_at: new Date().toISOString(),
      salons: cards,
      actions: [
        { id: 'fb-b2', label: 'احجز الآن', kind: 'book', salon_id: salons[0].id, service_id: topServiceId },
        { id: 'fb-map2', label: 'الخريطة', kind: 'map' },
      ],
    }
  } catch {
    return {
      id: crypto.randomUUID(),
      message: 'اكتبي لي مدينتك أو «صالون شعر/أظافر» وأنا أرشّح لكِ خيارات قريبة.',
      is_user: false,
      created_at: new Date().toISOString(),
      actions: [
        { id: 'fb-map3', label: 'الخريطة', kind: 'map' },
        { id: 'fb-more2', label: 'اقتراحات أخرى', kind: 'more' },
      ],
    }
  }
}

const WELCOME_ROW: ChatRow = {
  id: 'welcome',
  message: ROSY_BOOKING_ASSISTANT_WELCOME,
  is_user: false,
  created_at: new Date().toISOString(),
}

type ChatRowDb = {
  id: string
  message?: string
  response?: string
  is_user?: boolean
  created_at: string
  rosey_salons?: unknown
  rosey_products?: unknown
  rosey_actions?: unknown
  rosey_entities?: unknown
  rosey_action?: unknown
}

function mapRowsFromDb(data: ChatRowDb[] | null): ChatRow[] {
  return (data ?? []).map((r) => {
    const isUser = r.is_user ?? true
    const salons = !isUser ? parseSalonCards(r.rosey_salons) : undefined
    const products = !isUser ? parseProductCards(r.rosey_products) : undefined
    const actions = !isUser ? parseChatActions(r.rosey_actions) : undefined
    const bookingFromDb = !isUser ? parseRoziBookingAction(r.rosey_action) : null
    let visionAdvisorResult: RozyVisionChatResult | undefined
    let storedRecommendationMode: RozyRecommendationMode | undefined
    if (!isUser && r.rosey_entities && typeof r.rosey_entities === 'object' && !Array.isArray(r.rosey_entities)) {
      const ent = r.rosey_entities as Record<string, unknown>
      storedRecommendationMode = parseRecommendationMode(ent[ROSEY_ENTITY_RECOMMENDATION_MODE_KEY])
      const raw = ent[ROZY_VISION_ADVISOR_ENTITY_KEY]
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>
        const m = o.mode
        if (m === 'hand' || m === 'face' || m === 'hair_color' || m === 'haircut' || m === 'hand_nail' || m === 'skin_analysis') {
          visionAdvisorResult = raw as RozyVisionChatResult
        }
      }
    }
    const recommendationMode = !isUser
      ? resolveRecommendationModeForRow({
          stored: storedRecommendationMode,
          booking: bookingFromDb,
          salons,
          products,
        })
      : undefined
    return {
      id: r.id,
      message: isUser ? (r.message || '') : (r.response || r.message || ''),
      is_user: isUser,
      created_at: r.created_at,
      salons,
      products,
      actions,
      recommendationMode,
      bookingAction: !isUser ? bookingFromDb : undefined,
      visionAdvisorResult,
    }
  })
}

type ChatMessageInsert = {
  user_id: string
  message: string
  response?: string
  is_user: boolean
  rosey_intent?: string | null
  rosey_entities?: Record<string, unknown>
  rosey_action?: RoziBookingAction | null
  rosey_salons?: RozySalonCard[] | null
  rosey_products?: RozyProductCard[] | null
  rosey_actions?: RozyChatAction[] | null
}

/**
 * Rosy Brain: history from `chat_messages`; replies + intent + DB context from Edge `rozi-chat`.
 */
export function useChat(userId: string | undefined, options?: UseChatOptions) {
  const { onBookingAction, salonOwnerSalesMode = false, onSalonOwnerSubscriptionIntent } = options ?? {}
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  /** True while a message with an image is being processed (skin / face analysis copy). */
  const [sendingImage, setSendingImage] = useState(false)
  const messagesRef = useRef<ChatRow[]>([])
  const prefServiceRef = useRef<RosyServiceType | null>(null)
  const voiceBookingAwaitingChoiceRef = useRef(false)
  const voiceOwnerSalesAwaitingAffirmRef = useRef(false)
  /** عدد رسائل المستخدم إلى rozi-chat والسلة غير فارغة (للجولة 2+ → دفع checkout) */
  const userEdgeTurnsWhileCartRef = useRef(0)
  /** منع الإرسال المزدوج + حد أدنى 150ms بين محاولات الإرسال */
  const sendBusyRef = useRef(false)
  const lastUserSendAtRef = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const reloadHistory = useCallback(async () => {
    if (!userId) {
      prefServiceRef.current = null
      setMessages([])
      setHistoryError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setHistoryError(null)
    voiceBookingAwaitingChoiceRef.current = false
    voiceOwnerSalesAwaitingAffirmRef.current = false
    userEdgeTurnsWhileCartRef.current = 0
    const { data, error } = await supabase
      .from('chat_messages')
      .select(
        'id, message, response, is_user, created_at, rosey_salons, rosey_products, rosey_actions, rosey_entities, rosey_action',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      prefServiceRef.current = null
      setMessages([])
      setHistoryError('تعذر تحميل المحادثة. تحققي من الاتصال وحاولي مجدداً.')
      setLoading(false)
      return
    }

    const rows = mapRowsFromDb(data)
    let sig = null as Awaited<ReturnType<typeof fetchRosyWelcomeContext>>['sig'] | null
    let memory = null as Awaited<ReturnType<typeof fetchRosyWelcomeContext>>['memory'] | null
    try {
      const ctx = await fetchRosyWelcomeContext(userId)
      sig = ctx.sig
      memory = ctx.memory
    } catch {
      sig = null
      memory = null
    }
    prefServiceRef.current =
      memory?.lastBooking?.rosyServiceType ??
      (sig ? topRosyServiceFromPreferenceSignals(sig) : null)

    let welcomeMsg = ROSY_BOOKING_ASSISTANT_WELCOME
    if (rows.length === 0 && salonOwnerSalesMode) {
      welcomeMsg = ROSY_OWNER_SALES_CHAT_WELCOME
    } else if (rows.length === 0 && !salonOwnerSalesMode) {
      let firstVisit = false
      try {
        firstVisit =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(STORAGE_KEYS.roseraRosyFirstWelcomeShown) !== '1'
      } catch {
        firstVisit = true
      }
      if (firstVisit) {
        welcomeMsg = ROSY_FIRST_VISIT_WELCOME
        try {
          localStorage.setItem(STORAGE_KEYS.roseraRosyFirstWelcomeShown, '1')
        } catch {
          /* ignore */
        }
      } else if (sig && memory) {
        welcomeMsg = buildRosyWelcomeFromMemoryAndSignals(memory, sig)
      }
    }

    setMessages(rows.length === 0 ? [{ ...WELCOME_ROW, message: welcomeMsg }] : rows)
    setLoading(false)
  }, [userId, salonOwnerSalesMode])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  const clearChatHistory = useCallback(async () => {
    if (!userId) return
    stopRosyVoicePlayback()
    const { error } = await supabase.from('chat_messages').delete().eq('user_id', userId)
    if (error) {
      console.error('clearChatHistory:', error)
      toast.error('تعذر مسح المحادثة.')
      return
    }
    toast.success('تم مسح المحادثة')
    await reloadHistory()
  }, [userId, reloadHistory])

  const kickoffSalonOwnerVoiceSales = useCallback(async () => {
    if (!userId || !salonOwnerSalesMode) return
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return
    const uid = authData.user.id
    const intro = ROSY_OWNER_VOICE_SALES_INTRO
    const botRow: ChatRow = {
      id: crypto.randomUUID(),
      message: intro,
      is_user: false,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m.filter((x) => x.id !== 'welcome'), botRow])
    captureRosyReplyGenerated('owner_voice_intro')
    voiceOwnerSalesAwaitingAffirmRef.current = true
    scheduleAssistantTts(intro, 'salon_owner_sales')
    try {
      const { error: insBotErr } = await supabase.from('chat_messages').insert({
        user_id: uid,
        message: intro,
        response: intro,
        is_user: false,
        rosey_intent: 'salon_owner_voice_sales_intro_v1',
        rosey_entities: {},
        rosey_action: null,
      } as never)
      if (insBotErr) logChatInsertError('assistant message (salon owner voice intro)', insBotErr)
    } catch (e) {
      console.error('Chat insert exception (salon owner voice intro):', e)
    }
  }, [userId, salonOwnerSalesMode])

  const sendMessage = useCallback(
    async (
      text: string,
      image?: { base64: string; mime: string } | null,
      clientGeo?: { lat: number; lng: number } | null,
      opts?: RozySendMessageOptions
    ) => {
      const rawTrim = text.trim()
      const normalizedText = rawTrim ? normalizeArabic(rawTrim) : ''
      if (!normalizedText && !image) return
      // History load failure should not freeze chat actions; clear banner on new interaction.
      setHistoryError(null)

      if (sendBusyRef.current) return
      const sendNow = Date.now()
      if (sendNow - lastUserSendAtRef.current < 150) return
      lastUserSendAtRef.current = sendNow
      sendBusyRef.current = true
      try {
      const { data: authData, error: authGetErr } = await supabase.auth.getUser()
      if (authGetErr || !authData?.user) {
        if (authGetErr) {
          console.error('Chat blocked — auth.getUser failed:', {
            message: authGetErr.message,
            name: authGetErr.name,
          })
        }
        toast.error('يجب تسجيل الدخول لإرسال الرسائل. سجّلي دخولكِ ثم أعيدي المحاولة.')
        return
      }
      const uid = authData.user.id

      const profileReady = await ensureProfileRow(authData.user)
      if (!profileReady) {
        console.error('Chat blocked — ensureUserProfile failed or profiles row missing (FK on chat_messages.user_id)', {
          userId: uid,
        })
        toast.error('تعذر تجهيز حسابكِ لحفظ المحادثة. حاولي مرة أخرى.')
        return
      }

      const displayText = image ? (normalizedText || 'صورة للتحليل (لا تُحفظ)') : normalizedText
      const userRow: ChatRow = {
        id: crypto.randomUUID(),
        message: displayText,
        is_user: true,
        created_at: new Date().toISOString(),
      }

      const priorRows = [...messagesRef.current.filter((m) => m.id !== 'welcome'), userRow]
      setMessages((m) => [...m.filter((x) => x.id !== 'welcome'), userRow])

      try {
        const { error: insUserErr } = await supabase.from('chat_messages').insert({
          user_id: uid,
          message: String(displayText),
          is_user: true,
        })
        if (insUserErr) {
          logChatInsertError('user message', insUserErr)
          toast.error('تعذر حفظ رسالتكِ. حاولي مرة أخرى.')
          setMessages((m) => m.filter((x) => x.id !== userRow.id))
          return
        }
        {
          const textLen = normalizedText.length
          const charBucket =
            textLen === 0 ? 'empty' : textLen <= 80 ? 'short' : textLen <= 400 ? 'medium' : 'long'
          captureProductEvent('chat_message_sent', {
            has_image: Boolean(image),
            input_source: opts?.fromVoice ? 'voice' : 'text',
            char_bucket: charBucket,
          })
        }
        } catch (e) {
        console.error('Chat insert exception (user message):', e)
        toast.error('تعذر حفظ رسالتكِ. حاولي مرة أخرى.')
        setMessages((m) => m.filter((x) => x.id !== userRow.id))
        return
      }

      if (image && opts?.visionAdvisorMode) {
        setSending(true)
        setSendingImage(true)
        const ttsOwner = salonOwnerSalesMode ? ('salon_owner_sales' as const) : undefined
        try {
          const pack = await invokeRozyAdvisor(opts.visionAdvisorMode, image.base64, image.mime)
          const assistantLabel = 'نتيجة تحليل روزي الذكي'
          const botRow: ChatRow = {
            id: crypto.randomUUID(),
            message: assistantLabel,
            is_user: false,
            created_at: new Date().toISOString(),
            visionAdvisorResult: pack,
          }
          setMessages((m) => [...m, botRow])
          captureRosyReplyGenerated('rozy_vision_advisor', { intent: pack.mode, had_error: false })
          scheduleAssistantTts(assistantLabel, ttsOwner)
          try {
            const { error: insBotErr } = await supabase.from('chat_messages').insert({
              user_id: uid,
              message: String(assistantLabel),
              response: String(assistantLabel),
              is_user: false,
              rosey_intent: 'rozy_vision_advisor_v1',
              rosey_entities: { [ROZY_VISION_ADVISOR_ENTITY_KEY]: pack },
              rosey_action: null,
            } as never)
            if (insBotErr) logChatInsertError('assistant message (rozy vision advisor)', insBotErr)
          } catch (insEx) {
            console.error('Chat insert exception (rozy vision advisor):', insEx)
          }
        } catch {
          const failMsg = VISION_FAIL_AR
          const botRow: ChatRow = {
            id: crypto.randomUUID(),
            message: failMsg,
            is_user: false,
            created_at: new Date().toISOString(),
          }
          setMessages((m) => [...m, botRow])
          captureRosyReplyGenerated('rozy_vision_advisor', { intent: null, had_error: true })
          scheduleAssistantTts(failMsg, ttsOwner)
          try {
            const { error: insBotErr } = await supabase.from('chat_messages').insert({
              user_id: uid,
              message: String(failMsg),
              response: String(failMsg),
              is_user: false,
              rosey_intent: 'rozy_vision_advisor_error',
              rosey_entities: {},
              rosey_action: null,
            } as never)
            if (insBotErr) logChatInsertError('assistant message (rozy vision advisor error)', insBotErr)
          } catch (insEx) {
            console.error('Chat insert exception (rozy vision advisor error):', insEx)
          }
        } finally {
          setSending(false)
          setSendingImage(false)
        }
        return
      }

      setSending(true)
      setSendingImage(!!image)
      try {
        const ttsOwner = salonOwnerSalesMode ? ('salon_owner_sales' as const) : undefined

        const apiHistory: ApiMsg[] = priorRows.map((m) => ({
          role: m.is_user ? 'user' : 'assistant',
          content: m.message,
        }))
        if (image && !normalizedText) {
          apiHistory[apiHistory.length - 1] = {
            role: 'user',
            content: 'تحليل صورة الوجه للبشرة والعلاجات المقترحة (بدون حفظ الصورة)',
          }
        }

        if (!image) {
          const lastAssistantWithProducts = [...priorRows]
            .reverse()
            .find((m) => !m.is_user && m.products && m.products.length > 0)
          const topPick = lastAssistantWithProducts?.products?.[0]
          if (topPick && isRosyAffirmTopProductPhrase(normalizedText)) {
            const cart = useCartStore.getState()
            const hadBefore = cart.items.some((i) => i.productId === topPick.id)
            cart.add({
              productId: topPick.id,
              name_ar: topPick.name_ar,
              brand_ar: topPick.brand_ar ?? undefined,
              image_url: topPick.image_url ?? undefined,
              price: topPick.price,
              quantity: 1,
            })
            if (hadBefore) cart.bumpCartUiPulse()
            const n = useCartStore.getState().items.length
            const lineSummary = n === 1 ? 'سلتك فيها منتج واحد' : `سلتك فيها ${n} منتجات`
            const botText = `تم إضافة ${topPick.name_ar} إلى السلة.\n\n${lineSummary}\n\nهل تودين إكمال الطلب الآن؟`
            const checkoutAction: RozyChatAction = {
              id: 'rozy-go-checkout',
              label: 'إتمام الطلب',
              kind: 'go_to_checkout',
            }
            const botRow: ChatRow = {
              id: crypto.randomUUID(),
              message: botText,
              is_user: false,
              created_at: new Date().toISOString(),
              actions: [checkoutAction],
            }
            setMessages((m) => [...m, botRow])
            captureRosyReplyGenerated('affirm_cart_product')
            scheduleAssistantTts(botText, ttsOwner)
            try {
              const { error: insBotErr } = await supabase.from('chat_messages').insert({
                user_id: uid,
                message: String(botText),
                response: String(botText),
                is_user: false,
                rosey_intent: 'rosey_affirm_add_top_product',
                rosey_entities: { product_id: topPick.id },
                rosey_action: null,
                rosey_products: null,
                rosey_salons: null,
                rosey_actions: [checkoutAction],
              } as never)
              if (insBotErr) logChatInsertError('assistant message (affirm add product)', insBotErr)
            } catch (e) {
              console.error('Chat insert exception (affirm add product):', e)
            }
            return
          }

          if (
            opts?.fromVoice &&
            salonOwnerSalesMode &&
            voiceOwnerSalesAwaitingAffirmRef.current &&
            isVoiceSalonSubscriptionAffirm(normalizedText)
          ) {
            voiceOwnerSalesAwaitingAffirmRef.current = false
            const botText = ROSY_OWNER_VOICE_SUBSCRIPTION_NAV
            const affirmRow: ChatRow = {
              id: crypto.randomUUID(),
              message: botText,
              is_user: false,
              created_at: new Date().toISOString(),
            }
            setMessages((m) => [...m, affirmRow])
            captureRosyReplyGenerated('owner_subscription_nav')
            scheduleAssistantTts(botText, ttsOwner)
            try {
              const { error: insBotErr } = await supabase.from('chat_messages').insert({
                user_id: uid,
                message: String(botText),
                response: String(botText),
                is_user: false,
                rosey_intent: 'salon_owner_voice_subscription_nav_v1',
                rosey_entities: {},
                rosey_action: null,
              } as never)
              if (insBotErr) logChatInsertError('assistant message (salon owner sub nav)', insBotErr)
            } catch (e) {
              console.error('Chat insert exception (salon owner sub nav):', e)
            }
            onSalonOwnerSubscriptionIntent?.()
            return
          }

          if (voiceBookingAwaitingChoiceRef.current) {
            const pref = detectVoiceBookingPreference(normalizedText)
            if (pref) {
              voiceBookingAwaitingChoiceRef.current = false
              try {
                let userLocation = clientGeo ?? null
                let sortUsed: RecommendSort = pref === 'near' ? 'distance' : 'rating'
                if (sortUsed === 'distance' && !userLocation) {
                  userLocation = await requestBrowserGeolocation()
                  if (!userLocation) sortUsed = 'rating'
                }
                const allSalons = await getRecommendedSalons(uid, {
                  sort: sortUsed,
                  serviceType: prefServiceRef.current,
                  userLocation,
                  limit: 8,
                })
                const top = allSalons[0]
                const botText = top
                  ? `${top.subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}تم تحويلك إلى صفحة حجز ${top.name_ar} — أكملي التفاصيل هناك.`
                  : 'ما لقيت صالون مناسب الحين — جرّبي تختارين من الخريطة 💕'
                const botRow: ChatRow = {
                  id: crypto.randomUUID(),
                  message: botText,
                  is_user: false,
                  created_at: new Date().toISOString(),
                }
                setMessages((m) => [...m, botRow])
                captureRosyReplyGenerated('voice_booking_pick')
                scheduleAssistantTts(botText, ttsOwner)
                try {
                  const { error: insBotErr } = await supabase.from('chat_messages').insert({
                    user_id: uid,
                    message: String(botText),
                    response: String(botText),
                    is_user: false,
                    rosey_intent: 'voice_booking_pick_v1',
                    rosey_entities: { pref, sort: sortUsed, salonId: top?.id },
                    rosey_action: null,
                  } as never)
                  if (insBotErr) logChatInsertError('assistant message (voice booking pick)', insBotErr)
                } catch (e) {
                  console.error('Chat insert exception (voice booking pick):', e)
                }
                if (top) {
                  onBookingAction?.({ action: 'booking', salon_id: top.id })
                }
                return
              } catch (e) {
                console.error('Voice booking pick failed:', e)
                voiceBookingAwaitingChoiceRef.current = false
              }
            } else {
              voiceBookingAwaitingChoiceRef.current = false
            }
          }

          if (opts?.fromVoice && isVoiceBookingKickoff(normalizedText)) {
            voiceBookingAwaitingChoiceRef.current = true
            const botText = 'رائع، سأبدأ الحجز الآن.\nهل تفضّلين الأقرب أم الأعلى تقييمًا؟'
            const botRow: ChatRow = {
              id: crypto.randomUUID(),
              message: botText,
              is_user: false,
              created_at: new Date().toISOString(),
            }
            setMessages((m) => [...m, botRow])
            captureRosyReplyGenerated('voice_booking_prompt')
            scheduleAssistantTts(botText, ttsOwner)
            try {
              const { error: insBotErr } = await supabase.from('chat_messages').insert({
                user_id: uid,
                message: String(botText),
                response: String(botText),
                is_user: false,
                rosey_intent: 'voice_booking_prompt_v1',
                rosey_entities: {},
                rosey_action: null,
              } as never)
              if (insBotErr) logChatInsertError('assistant message (voice booking prompt)', insBotErr)
            } catch (e) {
              console.error('Chat insert exception (voice booking prompt):', e)
            }
            return
          }

          const rankIntent = detectRosyRankFromMessage(normalizedText, prefServiceRef.current)
          if (rankIntent) {
            try {
              const { sort, serviceType } = rankIntent
              let userLocation = clientGeo ?? null
              let sortUsed = sort
              if (sort === 'distance' && !userLocation) {
                userLocation = await requestBrowserGeolocation()
                if (!userLocation) {
                  sortUsed = 'rating'
                }
              }

              const allSalons = await getRecommendedSalons(uid, {
                sort: sortUsed,
                serviceType,
                userLocation,
                limit: 12,
              })
              const salons = allSalons.slice(0, 3)
              const previewBySalon = await fetchRosySalonBookingPreview(salons.map((s) => s.id))
              const topFirst =
                salons[0] != null ? previewBySalon.get(salons[0].id) : null
              const topServiceId = topFirst?.firstServiceId ?? null

              const emptyText =
                'ما لقيت مطابقة فورية — جرّبي الخريطة أو اختاري من الاقتراحات أدناه.'
              let botText: string
              let salonsCards: RozySalonCard[] | undefined
              let uiActions: RozyChatAction[] | undefined

              if (salons.length === 0) {
                botText = emptyText
                uiActions = [
                  { id: 'rosy-empty-map', label: 'خريطة الصالونات', kind: 'map' },
                  { id: 'rosy-empty-more', label: 'اقتراحات أخرى', kind: 'more' },
                ]
              } else if (salons.length === 1) {
                const svcHint =
                  topFirst?.firstServiceNameAr != null
                    ? `\nخدمة مقترحة: ${topFirst.firstServiceNameAr}`
                    : ''
                botText = `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}ممتاز.\nهذا أنسب خيار لكِ الآن.${svcHint}\nهل نكمل الحجز؟`
                salonsCards = undefined
                uiActions = [
                  {
                    id: 'rosy-direct-book',
                    label: 'احجز الآن',
                    kind: 'book',
                    salon_id: salons[0].id,
                    service_id: topServiceId,
                  },
                  {
                    id: 'rosy-direct-detail',
                    label: 'عرض التفاصيل',
                    kind: 'salon_detail',
                    salon_id: salons[0].id,
                    service_id: topServiceId,
                  },
                  { id: 'rosy-see-other', label: 'شوفي خيارات ثانية', kind: 'more' },
                ]
              } else {
                botText = `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}ممتاز.\nهذه أفضل الخيارات المناسبة لكِ.`
                salonsCards = salons.map(salonMetaToCard)
                uiActions = [
                  {
                    id: 'rosy-book-top',
                    label: 'احجز الآن',
                    kind: 'book',
                    salon_id: salons[0].id,
                    service_id: topServiceId,
                  },
                  {
                    id: 'rosy-detail-top',
                    label: 'عرض التفاصيل',
                    kind: 'salon_detail',
                    salon_id: salons[0].id,
                    service_id: topServiceId,
                  },
                  { id: 'rosy-map-near', label: 'شوفي على الخريطة', kind: 'map' },
                ]
              }

              const smartRecoMode: RozyRecommendationMode = salons.length === 0 ? 'none' : 'salon'
              const botRow: ChatRow = {
                id: crypto.randomUUID(),
                message: botText,
                is_user: false,
                created_at: new Date().toISOString(),
                salons: salonsCards,
                actions: uiActions,
                recommendationMode: smartRecoMode,
              }
              setMessages((m) => [...m, botRow])
              captureRosyReplyGenerated('smart_rank')
              scheduleAssistantTts(botText, ttsOwner)

              const insertPayload: ChatMessageInsert = {
                user_id: uid,
                message: String(botText),
                response: String(botText),
                is_user: false,
                rosey_intent: 'rosey_smart_rank_v1',
                rosey_entities: {
                  sort: sortUsed,
                  serviceType,
                  hadGeo: userLocation != null,
                  variant: salons.length === 1 ? 'single_best' : salons.length > 1 ? 'multi' : 'empty',
                  [ROSEY_ENTITY_RECOMMENDATION_MODE_KEY]: smartRecoMode,
                },
                rosey_action: null,
                rosey_salons: salonsCards ?? null,
                rosey_actions: uiActions ?? null,
              }
              try {
                const { error: insBotErr } = await supabase.from('chat_messages').insert(insertPayload as never)
                if (insBotErr) {
                  logChatInsertError('assistant message (rosey smart)', insBotErr)
                  toast.error('تم استلام الرد لكن تعذر حفظه في السجل.')
                }
              } catch (e) {
                console.error('Chat insert exception (assistant rosey smart):', e)
                toast.error('تم استلام الرد لكن تعذر حفظه في السجل.')
              }
              return
            } catch (e) {
              console.error('Rosy smart rank failed, falling back to rozi-chat:', e)
            }
          }
        }

        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
        const accessToken = refreshed.session?.access_token
        if (refreshErr || !accessToken) {
          const { error: authErr } = await supabase.auth.getUser()
          toast.error(
            authErr
              ? 'انتهت صلاحية الجلسة أو تعذر التحقق منها. سجّلي دخولكِ مرة أخرى.'
              : 'تعذر تجديد الجلسة لروزي. سجّلي خروجاً ثم دخولاً من جديد.'
          )
          return
        }

        let cartLineCount = 0
        let cartTotalQty = 0
        let checkoutUserTurnsWithCart = 0
        let checkoutShortAffirm = false
        let checkoutRecentCartAdd = false

        let checkoutClickedFromRosy = false
        if (!image && !salonOwnerSalesMode) {
          const cartState = useCartStore.getState()
          cartLineCount = cartState.items.length
          cartTotalQty = cartState.count()
          checkoutClickedFromRosy = cartState.rosyCheckoutCtaClicked
          if (cartLineCount === 0) {
            userEdgeTurnsWhileCartRef.current = 0
          } else {
            userEdgeTurnsWhileCartRef.current += 1
            checkoutUserTurnsWithCart = userEdgeTurnsWhileCartRef.current
          }
          checkoutShortAffirm = isRosyCheckoutShortAffirm(normalizedText)
          if (cartLineCount > 0) {
            checkoutRecentCartAdd = cartState.consumeCheckoutNudgePending()
          }
        }

        const { data, error, response: fnResponse } = await supabase.functions.invoke('rozi-chat', {
          body: {
            messages: apiHistory,
            imageBase64: image?.base64,
            imageMimeType: image?.mime,
            userLat: clientGeo?.lat,
            userLng: clientGeo?.lng,
            cartLineCount,
            cartTotalQty,
            checkoutRecentCartAdd,
            checkoutShortAffirm,
            checkoutUserTurnsWithCart,
            checkoutClickedFromRosy,
            salonOwnerSalesMode,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        const payload = data as RoziBrainPayload | null
        const gotReply = Boolean(payload && typeof payload.reply === 'string' && payload.reply.trim())

        if (!gotReply) {
          if (error) {
            const fromBody = await getEdgeFunctionHttpErrorDetail(error, fnResponse ?? null)
            const hint = fromBody ?? getEdgeFunctionErrorMessage(error as Error, data)
            if (/invalid\s*jwt/i.test(hint)) {
              const sessionRow: ChatRow = {
                id: crypto.randomUUID(),
                message: 'انتهت الجلسة — سجّلي دخولكِ مرة ثانية وأكملي مع روزي.',
                is_user: false,
                created_at: new Date().toISOString(),
              }
              setMessages((m) => [...m, sessionRow])
              scheduleAssistantTts(sessionRow.message, ttsOwner)
              captureRosyReplyGenerated('rozi_chat', { intent: null, had_error: true })
              try {
                await supabase.from('chat_messages').insert({
                  user_id: uid,
                  message: sessionRow.message,
                  response: sessionRow.message,
                  is_user: false,
                  rosey_intent: 'session_expired_hint',
                  rosey_entities: {},
                  rosey_action: null,
                } as never)
              } catch (insErr) {
                console.error('Chat insert exception (session hint):', insErr)
              }
              return
            }
          }

          const fb = await buildActionableFallbackRow(uid, clientGeo)
          const messageToStore = image ? appendMedicalDisclaimerToReply(fb.message) : fb.message
          const botRow: ChatRow = { ...fb, message: messageToStore }
          setMessages((m) => [...m, botRow])
          scheduleAssistantTts(messageToStore, ttsOwner)
          captureRosyReplyGenerated('rozi_chat_fallback', { intent: null, had_error: true })
          try {
            const { error: insBotErr } = await supabase.from('chat_messages').insert({
              user_id: uid,
              message: String(messageToStore),
              response: String(messageToStore),
              is_user: false,
              rosey_intent: 'rosey_actionable_fallback',
              rosey_entities: {},
              rosey_action: null,
              rosey_salons: botRow.salons ?? null,
              rosey_products: null,
              rosey_actions: botRow.actions ?? null,
            } as never)
            if (insBotErr) logChatInsertError('assistant message (actionable fallback)', insBotErr)
          } catch (insEx) {
            console.error('Chat insert exception (assistant fallback):', insEx)
          }
          return
        }

        const botText = payload!.reply as string
        const messageToStore = image ? appendMedicalDisclaimerToReply(botText) : botText
        const brain = payload?.brain
        const rawAction = payload?.action

        const bookingAction: RoziBookingAction | null =
          rawAction &&
          rawAction.action === 'booking' &&
          typeof rawAction.salon_id === 'string' &&
          rawAction.salon_id.length > 0
            ? {
                action: 'booking',
                salon_id: rawAction.salon_id,
                service_id: rawAction.service_id ?? null,
                booking_date: rawAction.booking_date ?? null,
                suggested_slots: rawAction.suggested_slots,
              }
            : null

        if (bookingAction) {
          onBookingAction?.(bookingAction)
        }

        const salonsCards = parseSalonCards(payload?.salons)
        const productCards = parseProductCards(payload?.products)
        const uiActions = parseChatActions(payload?.actions)

        const recommendationModeFromMeta = parseRecommendationMode(payload?.meta?.recommendation_mode)
        const recommendationMode = resolveRecommendationModeForRow({
          stored: recommendationModeFromMeta,
          booking: bookingAction,
          salons: salonsCards,
          products: productCards,
        })

        const roseyEnt = brain?.entities as Record<string, unknown> | undefined
        if (roseyEnt?.checkout_hesitation === true) {
          const toneRaw = roseyEnt.checkout_hesitation_tone
          if (typeof toneRaw === 'string' && /^(direct|soft|choice)$/.test(toneRaw)) {
            rememberRosyHesitationToneForCheckout(toneRaw)
            trackEvent({
              user_id: uid,
              event_type: 'rosy_hesitation_tone_shown',
              entity_type: 'preference',
              entity_id: uid,
              metadata: { tone: toneRaw, checkout_hesitation_tone: toneRaw },
            })
          }
        }

        const metaBlob = compactResponseMeta(payload?.meta)

        const botRow: ChatRow = {
          id: crypto.randomUUID(),
          message: messageToStore,
          is_user: false,
          created_at: new Date().toISOString(),
          salons: salonsCards,
          products: productCards,
          actions: uiActions,
          recommendationMode,
          bookingAction,
        }
        setMessages((m) => [...m, botRow])
        scheduleAssistantTts(messageToStore, ttsOwner)
        captureRosyReplyGenerated('rozi_chat', {
          intent: typeof brain?.intent === 'string' ? brain.intent : null,
          had_error: false,
        })

        const insertPayload: ChatMessageInsert = {
          user_id: uid,
          message: String(messageToStore),
          response: String(messageToStore),
          is_user: false,
          rosey_intent: brain?.intent ?? null,
          rosey_entities: {
            ...(brain?.entities ?? {}),
            [ROSEY_ENTITY_RECOMMENDATION_MODE_KEY]: recommendationMode,
            ...(metaBlob ? { [ROSEY_ENTITY_RESPONSE_META_KEY]: metaBlob } : {}),
          },
          rosey_action: bookingAction,
          rosey_salons: salonsCards ?? null,
          rosey_products: productCards ?? null,
          rosey_actions: uiActions ?? null,
        }

        try {
          const { error: insBotErr } = await supabase.from('chat_messages').insert(insertPayload as never)
          if (insBotErr) {
            logChatInsertError('assistant message', insBotErr)
            toast.error('تم استلام الرد لكن تعذر حفظه في السجل.')
          }
        } catch (e) {
          console.error('Chat insert exception (assistant message):', e)
          toast.error('تم استلام الرد لكن تعذر حفظه في السجل.')
        }
        if (
          salonOwnerSalesMode &&
          opts?.fromVoice &&
          (brain?.salon_subscription_pitch || brain?.salon_subscription_pitch_follow_up)
        ) {
          voiceOwnerSalesAwaitingAffirmRef.current = true
        }
      } catch (e) {
        console.error('rozi-chat pipeline failed:', e)
        const ttsOwnerErr = salonOwnerSalesMode ? ('salon_owner_sales' as const) : undefined
        try {
          const fb = await buildActionableFallbackRow(uid, clientGeo)
          const messageToStore = image ? appendMedicalDisclaimerToReply(fb.message) : fb.message
          const botRow: ChatRow = { ...fb, message: messageToStore }
          setMessages((m) => [...m, botRow])
          scheduleAssistantTts(messageToStore, ttsOwnerErr)
          captureRosyReplyGenerated('send_exception')
          try {
            await supabase.from('chat_messages').insert({
              user_id: uid,
              message: String(messageToStore),
              response: String(messageToStore),
              is_user: false,
              rosey_intent: 'rosey_actionable_fallback',
              rosey_entities: { source: 'send_exception' },
              rosey_action: null,
              rosey_salons: botRow.salons ?? null,
              rosey_products: null,
              rosey_actions: botRow.actions ?? null,
            } as never)
          } catch (insEx) {
            console.error('Chat insert exception (exception fallback):', insEx)
          }
        } catch {
          const botRow: ChatRow = {
            id: crypto.randomUUID(),
            message: 'اكتبي لي مدينتك أو نوع الخدمة — أو افتحي الخريطة من الأسفل.',
            is_user: false,
            created_at: new Date().toISOString(),
            actions: [
              { id: 'fb-map-x', label: 'الخريطة', kind: 'map' },
              { id: 'fb-more-x', label: 'اقتراحات أخرى', kind: 'more' },
            ],
          }
          setMessages((m) => [...m, botRow])
          captureRosyReplyGenerated('send_exception')
          scheduleAssistantTts(botRow.message, ttsOwnerErr)
        }
      } finally {
        setSending(false)
        setSendingImage(false)
      }
      } finally {
        sendBusyRef.current = false
      }
    },
    [onBookingAction, salonOwnerSalesMode, onSalonOwnerSubscriptionIntent]
  )

  return {
    messages,
    loading,
    historyError,
    sending,
    sendingImage,
    sendMessage,
    reloadHistory,
    clearChatHistory,
    kickoffSalonOwnerVoiceSales,
  }
}
