import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getEdgeFunctionErrorMessage, getEdgeFunctionHttpErrorDetail } from '@/lib/edgeInvoke'
import type { RozyChatAction, RozySalonCard } from '@/lib/roseyChatTypes'
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
  ROSY_OWNER_SALES_CHAT_WELCOME,
  ROSY_OWNER_VOICE_SALES_INTRO,
  ROSY_OWNER_VOICE_SUBSCRIPTION_NAV,
} from '@/lib/roseyChatCopy'
import { requestBrowserGeolocation, type RosyServiceType } from '@/lib/roseySalonSuggestions'
import { normalizeArabic } from '@/lib/normalizeArabic'
import { speak } from '@/lib/voice'

const ROSY_PREMIUM_TOP_LINE = 'هذا من أفضل الصالونات المميزة ⭐\n'

function logChatInsertError(label: string, err: PostgrestError) {
  console.error(`Chat insert error (${label}):`, {
    message: err.message,
    details: err.details,
    code: err.code,
    hint: err.hint,
  })
}

function randomInviteCode(): string {
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12).toUpperCase()
}

/** يضمن وجود صف في profiles قبل chat_messages (FK). يتطلب سياسة INSERT في migration 051. */
async function ensureProfileRow(uid: string, user: User): Promise<boolean> {
  const { data: existing, error: selErr } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle()

  if (selErr) {
    console.error('Profile lookup failed:', {
      message: selErr.message,
      details: selErr.details,
      code: selErr.code,
    })
    return false
  }
  if (existing?.id) return true

  const email = user.email ?? ''
  const meta = user.user_metadata ?? {}
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (email ? email.split('@')[0] : '') ||
    null

  const { error: insErr } = await supabase.from('profiles').insert({
    id: uid,
    email: email || null,
    full_name: fullName,
    invite_code: randomInviteCode(),
    role: 'user',
    created_at: new Date().toISOString(),
  })

  if (insErr) {
    if (insErr.code === '23505') return true
    console.error('Profile insert failed:', {
      message: insErr.message,
      details: insErr.details,
      code: insErr.code,
    })
    return false
  }

  console.warn('Created missing profile for user:', uid)
  return true
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

export type ChatRow = {
  id: string
  message: string
  is_user: boolean
  created_at: string
  salons?: RozySalonCard[]
  actions?: RozyChatAction[]
}

export type RoziBookingAction = {
  action: 'booking'
  salon_id: string
  service_id?: string | null
  booking_date?: string | null
  suggested_slots?: string[]
}

export type RoziBrainPayload = {
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
  actions?: RozyChatAction[]
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
    out.push({
      id,
      label,
      salon_id,
      kind,
      service_id,
      discount_percent: discount_percent != null && Number.isFinite(discount_percent) ? discount_percent : null,
    })
  }
  return out.length ? out : undefined
}

export type UseChatOptions = {
  /** When Edge returns a structured booking action, e.g. navigate to `/booking/:salonId`. */
  onBookingAction?: (action: RoziBookingAction) => void
  /** مالكة صالون (portal أو دور owner/salon_owner): وضع مبيعات + صوت Bella الناعم + «اي/تمام» → اشتراك */
  salonOwnerSalesMode?: boolean
  /** بعد تأكيد صوتي للاشتراك — يُستدعى من AiChat للتوجيه */
  onSalonOwnerSubscriptionIntent?: () => void
}

type ApiMsg = { role: 'user' | 'assistant'; content: string }

export type RozySendMessageOptions = {
  /** رد صوتي عبر ElevenLabs/المتصفح بعد رد المساعد */
  fromVoice?: boolean
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

async function speakAssistantIfVoice(
  fromVoice: boolean | undefined,
  botText: string,
  voiceMode?: 'salon_owner_sales'
) {
  if (!fromVoice) return
  try {
    await speak(botText, voiceMode ? { mode: voiceMode } : undefined)
  } catch {
    /* يبقى النص في الشات */
  }
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

  if (!hasNear && !explicitBest && !cheap && !hasNails && !hasHair && !hasLaser && !(vagueSalon && memoryService))
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
  rosey_actions?: unknown
}

function mapRowsFromDb(data: ChatRowDb[] | null): ChatRow[] {
  return (data ?? []).map((r) => {
    const isUser = r.is_user ?? true
    const salons = !isUser ? parseSalonCards(r.rosey_salons) : undefined
    const actions = !isUser ? parseChatActions(r.rosey_actions) : undefined
    return {
      id: r.id,
      message: isUser ? (r.message || '') : (r.response || r.message || ''),
      is_user: isUser,
      created_at: r.created_at,
      salons,
      actions,
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
  const messagesRef = useRef<ChatRow[]>([])
  const prefServiceRef = useRef<RosyServiceType | null>(null)
  const voiceBookingAwaitingChoiceRef = useRef(false)
  const voiceOwnerSalesAwaitingAffirmRef = useRef(false)

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
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, message, response, is_user, created_at, rosey_salons, rosey_actions')
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
    const welcomeMsg =
      rows.length === 0 && salonOwnerSalesMode
        ? ROSY_OWNER_SALES_CHAT_WELCOME
        : rows.length === 0 && sig && memory
          ? buildRosyWelcomeFromMemoryAndSignals(memory, sig)
          : ROSY_BOOKING_ASSISTANT_WELCOME
    setMessages(rows.length === 0 ? [{ ...WELCOME_ROW, message: welcomeMsg }] : rows)
    setLoading(false)
  }, [userId, salonOwnerSalesMode])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

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
    voiceOwnerSalesAwaitingAffirmRef.current = true
    try {
      await speak(intro, { mode: 'salon_owner_sales' })
    } catch {
      /* يبقى النص */
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

      const profileReady = await ensureProfileRow(uid, authData.user)
      if (!profileReady) {
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
      } catch (e) {
        console.error('Chat insert exception (user message):', e)
        toast.error('تعذر حفظ رسالتكِ. حاولي مرة أخرى.')
        setMessages((m) => m.filter((x) => x.id !== userRow.id))
        return
      }

      setSending(true)
      try {
        const ttsOwner = opts?.fromVoice && salonOwnerSalesMode ? ('salon_owner_sales' as const) : undefined

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
            await speakAssistantIfVoice(true, botText, ttsOwner)
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
                  ? `${top.subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}تمام 💖 أحوّلكِ لحجز ${top.name_ar} — أكملي التفاصيل هناك ✨`
                  : 'ما لقيت صالون مناسب الحين — جرّبي تختارين من الخريطة 💕'
                const botRow: ChatRow = {
                  id: crypto.randomUUID(),
                  message: botText,
                  is_user: false,
                  created_at: new Date().toISOString(),
                }
                setMessages((m) => [...m, botRow])
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
                await speakAssistantIfVoice(opts?.fromVoice, botText, ttsOwner)
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
            const botText = 'أكيد 💖 بحجز لكِ الآن\nتبغين الأقرب ولا الأعلى تقييم؟'
            const botRow: ChatRow = {
              id: crypto.randomUUID(),
              message: botText,
              is_user: false,
              created_at: new Date().toISOString(),
            }
            setMessages((m) => [...m, botRow])
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
            await speakAssistantIfVoice(true, botText, ttsOwner)
            return
          }

          const rankIntent = detectRosyRankFromMessage(normalizedText, prefServiceRef.current)
          if (rankIntent) {
            try {
              let { sort, serviceType } = rankIntent
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
              console.log('[Rosy smart suggest] salons', salons)

              const emptyText = 'ما لقيت شيء مناسب 😢\nخليني أوريك الأقرب لك'
              let botText: string
              let salonsCards: RozySalonCard[] | undefined
              let uiActions: RozyChatAction[] | undefined

              if (salons.length === 0) {
                botText = emptyText
              } else if (salons.length === 1) {
                botText = `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}أكيد حبيبتي 💖\nهذا أنسب خيار لكِ الآن ✨\nتحبي نكمّل الحجز؟`
                salonsCards = undefined
                uiActions = [
                  { id: 'rosy-direct-book', label: 'احجزي الآن', kind: 'book', salon_id: salons[0].id },
                  { id: 'rosy-see-other', label: 'شوفي خيارات ثانية', kind: 'more' },
                ]
              } else {
                botText = `${salons[0].subscription_plan === 'premium' ? ROSY_PREMIUM_TOP_LINE : ''}أكيد حبيبتي 💖\nلقيت لك أفضل الخيارات 👇✨`
                salonsCards = salons.map(salonMetaToCard)
                uiActions = [
                  { id: 'rosy-book-top', label: 'احجزي الأنسب', kind: 'book', salon_id: salons[0].id },
                  { id: 'rosy-map-near', label: 'شوفي على الخريطة', kind: 'map' },
                ]
              }

              const botRow: ChatRow = {
                id: crypto.randomUUID(),
                message: botText,
                is_user: false,
                created_at: new Date().toISOString(),
                salons: salonsCards,
                actions: uiActions,
              }
              setMessages((m) => [...m, botRow])

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
              await speakAssistantIfVoice(opts?.fromVoice, botText, ttsOwner)
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

        const { data, error, response: fnResponse } = await supabase.functions.invoke('rozi-chat', {
          body: {
            messages: apiHistory,
            imageBase64: image?.base64,
            imageMimeType: image?.mime,
            userLat: clientGeo?.lat,
            userLng: clientGeo?.lng,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        const payload = data as RoziBrainPayload | null
        let botText: string
        if (payload && typeof payload.reply === 'string' && payload.reply.trim()) {
          botText = payload.reply
        } else if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          botText =
            'ياليت نتأكد من الإعدادات لاحقاً 💕 الآن جرّبي تكتبين طلبك بطريقة ثانية، أو استكشفي الخريطة من التطبيق.'
        } else if (error) {
          const fromBody = await getEdgeFunctionHttpErrorDetail(error, fnResponse ?? null)
          const hint = fromBody ?? getEdgeFunctionErrorMessage(error as Error, data)
          const generic =
            hint === 'Edge Function returned a non-2xx status code' || hint === 'حدث خطأ في الخادم'
          const jwtHint = /invalid\s*jwt/i.test(hint)
          botText = jwtHint
            ? 'انتهت الجلسة يا حلوة — سجّلي دخولكِ مرة ثانية وأكملي مع روزي 💖'
            : generic
              ? 'روزي تعطلت لحظة من غير ما ندري ليش 💕 جرّبي بعد شوي، أو افتحي خريطة الصالونات من الأسفل.'
              : 'صار عندي تعثر بسيط — جرّبي مرة ثانية، وإن ما ضبط رجعي بعد دقايق.'
        } else {
          botText = 'ما لقيت رد واضح — جرّبي جملة أبسط، وأنا هنا أعدّل لك 💕'
        }

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
        const uiActions = parseChatActions(payload?.actions)

        const botRow: ChatRow = {
          id: crypto.randomUUID(),
          message: messageToStore,
          is_user: false,
          created_at: new Date().toISOString(),
          salons: salonsCards,
          actions: uiActions,
        }
        setMessages((m) => [...m, botRow])

        const insertPayload: ChatMessageInsert = {
          user_id: uid,
          message: String(messageToStore),
          response: String(messageToStore),
          is_user: false,
          rosey_intent: brain?.intent ?? null,
          rosey_entities: brain?.entities ?? {},
          rosey_action: bookingAction,
          rosey_salons: salonsCards ?? null,
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
        await speakAssistantIfVoice(opts?.fromVoice, messageToStore, ttsOwner)
      } catch {
        const botRow: ChatRow = {
          id: crypto.randomUUID(),
          message: 'صار شيء مو متوقع من جهتي 💕 جرّبي تكتبين مرة ثانية.',
          is_user: false,
          created_at: new Date().toISOString(),
        }
        setMessages((m) => [...m, botRow])
        const ttsOwnerErr = opts?.fromVoice && salonOwnerSalesMode ? ('salon_owner_sales' as const) : undefined
        await speakAssistantIfVoice(opts?.fromVoice, botRow.message, ttsOwnerErr)
      } finally {
        setSending(false)
      }
    },
    [onBookingAction, salonOwnerSalesMode, onSalonOwnerSubscriptionIntent]
  )

  return {
    messages,
    loading,
    historyError,
    sending,
    sendMessage,
    reloadHistory,
    kickoffSalonOwnerVoiceSales,
  }
}
