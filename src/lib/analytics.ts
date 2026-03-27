import { supabase } from '@/lib/supabase'
import { insertUserEventRow } from '@/lib/insertUserEvent'
import { captureProductEvent, initPostHog } from '@/lib/posthog'

export {
  initPostHog,
  captureProductEvent,
  captureBookingFailed,
  captureVisionFailed,
  sanitizeFeedbackNotePreview,
  BOOKING_FAILED_REASONS,
  VISION_FAILED_REASONS,
  syncPostHogIdentity,
  PRODUCT_ANALYTICS_EVENTS,
  trackCategoryFilterSelected,
} from '@/lib/posthog'
export type { BookingFailedReason, BookingFailedExtra, VisionFailedReason, VisionFailedExtra } from '@/lib/posthog'

export { insertUserEventRow } from '@/lib/insertUserEvent'
export type { UserEventInsertResult } from '@/lib/insertUserEvent'
import type { UserPreferenceSource } from '@/lib/roseyUserPreference'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type TrackEventLegacyArgs = {
  event_type: string
  entity_type: string
  entity_id: string
  user_id?: string | null
  metadata?: Record<string, unknown>
}

export type CtaClickEmptyStatePayload = { source: string; type: 'empty_state' }

export type RosyBookingClickPayload = {
  salonId: string
  source: string
  quick?: boolean
  rosyNegotiationPct?: number
  /** من روزي: حجز مباشر أو فتح صفحة الصالون أو روزي فيجن */
  cta?:
    | 'book_now'
    | 'view_details'
    | 'book_look'
    | 'hair_consult'
    | 'book_look_footer'
    | 'hair_consult_footer'
  serviceId?: string
}

/** Saved to user_events (event_type user_preference) for Rosy ranking + memory */
export type UserPreferenceTrackPayload = {
  user_id?: string | null
  source: UserPreferenceSource
  service?: string | null
  salon_id?: string | null
  price_range?: string | null
  location?: string | null
}

export type PwaInstalledPayload = {
  /** عند وصول الحدث غالباً ما يزال التبويب في المتصفح */
  display_mode_hint: 'standalone' | 'browser_tab'
  language: string
  origin: string
}

function pushStructuredAnalyticsEvent(name: string, payload: Record<string, unknown>): void {
  try {
    const w = window as Window & { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: name, ...payload })
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent('rosera:analytics', {
        detail: { event: name, ...payload, ts: Date.now() },
      })
    )
  } catch {
    /* ignore */
  }
}

/** Rosy Vision — dataLayer + PostHog (no image data). */
export function trackRosyVisionProductEvent(
  name:
    | 'rosy_hand_analysis_started'
    | 'rosy_hand_analysis_completed'
    | 'rosy_hair_analysis_completed',
  payload?: { quality_ok?: boolean; confidence?: string },
): void {
  const safe: Record<string, unknown> = {
    ...(payload?.quality_ok !== undefined ? { quality_ok: payload.quality_ok } : {}),
    ...(payload?.confidence ? { confidence: payload.confidence.slice(0, 24) } : {}),
  }
  pushStructuredAnalyticsEvent(name, safe)
  captureProductEvent(name, {
    ...(payload?.quality_ok !== undefined ? { quality_ok: payload.quality_ok } : {}),
    ...(payload?.confidence ? { confidence: payload.confidence.slice(0, 24) } : {}),
  })
}

function pushCtaClick(source: string, type: string): void {
  try {
    const w = window as Window & { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'cta_click', source, type })
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent('rosera:analytics', {
        detail: { event: 'cta_click', source, type, ts: Date.now() },
      })
    )
  } catch {
    /* ignore */
  }
}

/** تتبع نقرات CTA من حالات الفراغ (بدون UUID — لا يُرسل لـ user_events). */
export function trackEvent(eventName: 'cta_click', payload: CtaClickEmptyStatePayload): void
/** تتبع انتقال الحجز من محادثة روزي — dataLayer + حدث مخصص فقط. */
export function trackEvent(eventName: 'rosy_booking_click', payload: RosyBookingClickPayload): void
/** تفضيلات المستخدم — يُحفظ في user_events مع metadata */
export function trackEvent(eventName: 'user_preference', payload: UserPreferenceTrackPayload): void
export function trackEvent(args: TrackEventLegacyArgs): void
export function trackEvent(
  a: 'cta_click' | 'rosy_booking_click' | 'user_preference' | TrackEventLegacyArgs,
  b?: CtaClickEmptyStatePayload | RosyBookingClickPayload | UserPreferenceTrackPayload
): void {
  if (a === 'cta_click' && b && typeof b === 'object' && 'type' in b && b.type === 'empty_state') {
    const source = b.source.trim() || 'unknown'
    pushCtaClick(source, b.type)
    return
  }

  if (a === 'rosy_booking_click' && b && typeof b === 'object' && 'salonId' in b) {
    const p = b as RosyBookingClickPayload
    const salonId = typeof p.salonId === 'string' ? p.salonId.trim() : ''
    const source = typeof p.source === 'string' ? p.source.trim() : 'chat'
    if (salonId) {
      pushStructuredAnalyticsEvent('rosy_booking_click', {
        salonId,
        source: source || 'chat',
        ...(p.quick === true ? { quick: true } : {}),
        ...(typeof p.rosyNegotiationPct === 'number' && Number.isFinite(p.rosyNegotiationPct)
          ? { rosyNegotiationPct: p.rosyNegotiationPct }
          : {}),
        ...(p.cta ? { cta: p.cta } : {}),
        ...(typeof p.serviceId === 'string' && p.serviceId.trim() ? { serviceId: p.serviceId.trim() } : {}),
      })
    }
    return
  }

  if (a === 'user_preference' && b && typeof b === 'object' && 'source' in b) {
    const p = b as UserPreferenceTrackPayload
    pushStructuredAnalyticsEvent('user_preference', {
      source: p.source,
      service: p.service ?? undefined,
      salon_id: p.salon_id ?? undefined,
      price_range: p.price_range ?? undefined,
      location: p.location ?? undefined,
    })
    void (async () => {
      let uid = typeof p.user_id === 'string' ? p.user_id.trim() : ''
      if (!uid) {
        const { data } = await supabase.auth.getUser()
        uid = data.user?.id?.trim() ?? ''
      }
      if (!uid || !UUID_RE.test(uid)) return
      const sid = typeof p.salon_id === 'string' ? p.salon_id.trim() : ''
      const useBusiness = Boolean(sid && UUID_RE.test(sid))
      const metadata = {
        source: p.source,
        service: p.service ?? null,
        salon_id: useBusiness ? sid : null,
        price_range: typeof p.price_range === 'string' ? p.price_range.trim() || null : null,
        location: typeof p.location === 'string' ? p.location.trim() || null : null,
      }
      await insertUserEventRow({
        user_id: uid,
        event_type: 'user_preference',
        entity_type: useBusiness ? 'business' : 'preference',
        entity_id: useBusiness ? sid : uid,
        metadata,
      })
    })()
    return
  }

  const args = a as TrackEventLegacyArgs
  const user_id = typeof args.user_id === 'string' ? args.user_id.trim() : ''
  const entity_id = typeof args.entity_id === 'string' ? args.entity_id.trim() : ''
  const event_type = typeof args.event_type === 'string' ? args.event_type.trim() : ''
  const entity_type = typeof args.entity_type === 'string' ? args.entity_type.trim() : ''

  if (!user_id || !entity_id || !event_type || !entity_type) return
  if (!UUID_RE.test(user_id) || !UUID_RE.test(entity_id)) return

  try {
    const w = window as Window & { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: event_type, entity_type, entity_id, user_id })
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(
      new CustomEvent('rosera:analytics', {
        detail: { event_type, entity_type, entity_id, user_id, ts: Date.now() },
      })
    )
  } catch {
    /* ignore */
  }

  const meta =
    args.metadata && typeof args.metadata === 'object' && !Array.isArray(args.metadata) ? args.metadata : undefined

  void insertUserEventRow({
    user_id,
    event_type,
    entity_type,
    entity_id,
    ...(meta && Object.keys(meta).length ? { metadata: meta } : {}),
  })
}

/** تهيئة PostHog عند تحميل الوحدة — يستوردها `main.tsx` */
initPostHog()

/**
 * يُستدعى عند `appinstalled` (Chrome / Edge / Android WebView المدعوم).
 * ملاحظة: «إضافة إلى الشاشة الرئيسية» في Safari على iOS لا يُطلق هذا الحدث عادةً.
 *
 * يُرسل إلى dataLayer + حدث `rosera:analytics`؛ ويُسجَّل في `user_events` عند وجود جلسة مسجّلة.
 */
export function trackPwaInstalled(): void {
  if (typeof window === 'undefined') return

  const payload: PwaInstalledPayload = {
    display_mode_hint: window.matchMedia('(display-mode: standalone)').matches
      ? 'standalone'
      : 'browser_tab',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    origin: window.location?.origin ?? '',
  }

  pushStructuredAnalyticsEvent('pwa_installed', {
    display_mode_hint: payload.display_mode_hint,
    language: payload.language,
    origin: payload.origin,
  })

  captureProductEvent('install_success', {
    display_mode_hint: payload.display_mode_hint,
  })

  if (import.meta.env.DEV) {
    console.info('[Rosera PWA] appinstalled', payload)
  }

  void (async () => {
    const { data } = await supabase.auth.getUser()
    const uid = data.user?.id?.trim() ?? ''
    if (!uid || !UUID_RE.test(uid)) return
    await insertUserEventRow({
      user_id: uid,
      event_type: 'pwa_installed',
      entity_type: 'preference',
      entity_id: uid,
      metadata: { ...payload, ts: Date.now() },
    })
  })()
}
