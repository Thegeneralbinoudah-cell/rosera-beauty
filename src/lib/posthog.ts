import type { User } from '@supabase/supabase-js'
import posthog from 'posthog-js'
import type { Profile } from '@/lib/supabase'

const POSTHOG_HOST = 'https://app.posthog.com'

let enabled = false
let globalErrorHandlersInstalled = false
/** آخر مستخدم تمّ identify له — يُستعاد قبل `app_error` لربط الأعطال بالمستخدم الحقيقي */
let posthogCachedUserId: string | null = null

function isReady(): boolean {
  return enabled && typeof window !== 'undefined'
}

/** أخطاء متصفح شائعة بلا فائدة تشخيصية — لا ترسل إلى PostHog */
const IGNORED_APP_ERROR_SUBSTRINGS = [
  'resizeobserver loop limit exceeded',
  'script error',
  'networkerror when attempting to fetch resource',
] as const

function shouldIgnoreAppErrorCapture(payload: { message: string; source: string; stack: string }): boolean {
  const haystack = `${payload.message}\n${payload.stack}\n${payload.source}`.toLowerCase()
  return IGNORED_APP_ERROR_SUBSTRINGS.some((s) => haystack.includes(s))
}

function captureAppErrorToPostHog(payload: {
  message: string
  source: string
  stack: string
  /** استثناءات متزامنة من window.onerror → critical؛ رفض وعد غير معالج → warning */
  fatal: boolean
}): void {
  if (!isReady()) return
  if (shouldIgnoreAppErrorCapture(payload)) return
  try {
    if (posthogCachedUserId) {
      posthog.identify(posthogCachedUserId)
    }
    const ua =
      typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
        ? navigator.userAgent
        : ''
    const msgFull = payload.message
    posthog.capture('app_error', {
      message: msgFull.slice(0, 500),
      fingerprint: msgFull.slice(0, 100),
      source: payload.source.slice(0, 500),
      stack: payload.stack.slice(0, 2500),
      path: window.location.pathname.slice(0, 500),
      user_agent: ua.slice(0, 512),
      timestamp: Date.now(),
      severity: payload.fatal ? 'critical' : 'warning',
    })
  } catch {
    /* ignore */
  }
}

function installGlobalErrorHandlersForPostHog(): void {
  if (typeof window === 'undefined' || !isReady() || globalErrorHandlersInstalled) return
  globalErrorHandlersInstalled = true

  const prevOnError = window.onerror
  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean => {
    try {
      const msg =
        typeof message === 'string'
          ? message
          : message && typeof Event !== 'undefined' && message instanceof Event
            ? `${message.type}`
            : String(message ?? 'error')
      const src =
        typeof source === 'string' && source
          ? source
          : lineno != null
            ? `onerror:${lineno}:${colno ?? 0}`
            : 'onerror'
      const stack = error?.stack?.trim() ?? ''
      captureAppErrorToPostHog({ message: msg, source: src, stack, fatal: true })
    } catch {
      /* ignore */
    }
    if (typeof prevOnError === 'function') {
      return prevOnError.call(window, message, source, lineno, colno, error) === true
    }
    return false
  }

  const prevOnRejection = window.onunhandledrejection
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    try {
      const reason = event.reason
      let message = 'unhandledrejection'
      let stack = ''
      if (reason instanceof Error) {
        message = reason.message || message
        stack = reason.stack?.trim() ?? ''
      } else if (typeof reason === 'string') {
        message = reason
      } else {
        try {
          message = JSON.stringify(reason).slice(0, 500)
        } catch {
          message = 'unhandledrejection(non-serializable)'
        }
      }
      captureAppErrorToPostHog({
        message,
        source: 'unhandledrejection',
        stack,
        fatal: false,
      })
    } catch {
      /* ignore */
    }
    if (typeof prevOnRejection === 'function') {
      prevOnRejection.call(window, event)
    }
  }
}

/**
 * أحداث المنتج الرئيسية (بدون محتوى رسائل أو بيانات تعريف شخصية).
 */
export const PRODUCT_ANALYTICS_EVENTS = [
  'app_open',
  'home_open',
  'install_prompt_shown',
  'install_clicked',
  'install_success',
  'rosy_open',
  'rosy_first_message_seen',
  'rosy_reply_generated',
  'rosy_to_booking',
  'rosy_to_booking_click',
  'rosy_abandon',
  'rosy_hand_analysis_started',
  'rosy_hand_analysis_completed',
  'rosy_hair_analysis_completed',
  'chat_message_sent',
  'map_open',
  'category_filter_selected',
  'salon_open',
  'booking_started',
  'booking_completed',
  'login_google_clicked',
  'login_apple_clicked',
  'app_error',
] as const

/**
 * تهيئة PostHog مرة واحدة — مفتاح المشروع من `VITE_POSTHOG_KEY`.
 * احترام DNT، بدون session replay، خصوصية: لا بريد/هاتف؛ identify بـ UUID + role + created_at.
 */
export function initPostHog(): void {
  if (typeof window === 'undefined' || enabled) return
  const key = (import.meta.env.VITE_POSTHOG_KEY as string | undefined)?.trim()
  if (!key) return

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    /** SPA: التقاط $pageview عند pushState/replaceState وليس فقط التحميل الأول */
    capture_pageview: 'history_change',
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: false,
    respect_dnt: true,
    disable_session_recording: true,
    /** افتراض PostHog: ملفات شخصية للمستخدمين المعرّفين فقط (لا بريد/هاتف من عندنا) */
    person_profiles: 'identified_only',
    /** لا نرسل نصوص طويلة؛ استثناء `stack` لحدث app_error لتشخيص الأعطال */
    sanitize_properties: (props, event) => {
      const ev = typeof event === 'string' ? event : ''
      const isAppError = ev === 'app_error'
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(props)) {
        if (typeof v !== 'string') {
          out[k] = v
          continue
        }
        const max =
          isAppError && k === 'stack' ? 2500 : isAppError && k === 'user_agent' ? 512 : 500
        out[k] = v.length > max ? `${v.slice(0, max)}…` : v
      }
      return out
    },
  })
  enabled = true
  installGlobalErrorHandlersForPostHog()
}

/**
 * بعد تسجيل الدخول: `identify(user.id)` ثم خصائص الشخص (role, created_at).
 * عند الخروج: reset ومسح الـ cache — أحداث `app_error` تستخدم الـ cache لإعادة الربط قبل الإرسال.
 */
export function syncPostHogIdentity(user: User | null, profile: Profile | null): void {
  if (!isReady()) return
  try {
    if (!user?.id) {
      posthogCachedUserId = null
      posthog.reset()
      return
    }
    posthogCachedUserId = user.id
    const roleRaw = (profile?.role ?? user.role ?? '').trim().slice(0, 64)
    const createdRaw = (user.created_at ?? '').trim().slice(0, 48)
    posthog.identify(user.id, {
      ...(roleRaw ? { role: roleRaw } : {}),
      ...(createdRaw ? { created_at: createdRaw } : {}),
    })
  } catch {
    /* ignore */
  }
}

type SafeProp = string | number | boolean | null | undefined

/**
 * أحداث المنتج — بدون محتوى رسائل أو بيانات دفع/صحة.
 */
export function captureProductEvent(event: string, props?: Record<string, SafeProp>): void {
  if (!isReady()) return
  try {
    const safe = sanitizeEventProps(props)
    posthog.capture(event, safe)
  } catch {
    /* ignore */
  }
}

/** تصنيف — مفتاح/تسمية قصيرة فقط (لا نص بحث حر). */
export function trackCategoryFilterSelected(surface: string, categoryKey: string): void {
  const safeKey = (categoryKey || 'all').trim().slice(0, 120)
  captureProductEvent('category_filter_selected', {
    surface: surface.slice(0, 64),
    category_key: safeKey || 'all',
  })
}

function sanitizeEventProps(props?: Record<string, SafeProp>): Record<string, SafeProp> {
  if (!props) return {}
  const out: Record<string, SafeProp> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.length > 200) continue
    out[k] = v
  }
  return out
}

export { posthog }
