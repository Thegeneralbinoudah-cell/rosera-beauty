import type { AuthError } from '@supabase/supabase-js'

/**
 * الرابط الذي يجب تسجيله في Google Cloud و Apple Developer (ليس رابط التطبيق).
 * Google: OAuth 2.0 Client → Authorized redirect URIs
 * Apple: Services ID → Sign in with Apple → Return URLs
 */
export function getSupabaseOAuthProviderRedirectUri(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  if (!base) return ''
  return `${base.replace(/\/$/, '')}/auth/v1/callback`
}

/** هل الرسالة تشير إلى خطأ redirect_uri في مزوّد Google/Apple؟ */
export function isRedirectUriMismatchMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('redirect_uri_mismatch') || lower.includes('redirect uri does not match')
}

/**
 * مسار إرجاع OAuth — يجب تطابقه مع Supabase Dashboard → URL Configuration → Redirect URLs.
 * اختياري: `VITE_AUTH_REDIRECT_URL` إذا كان `window.location.origin` لا يطابق Site URL (نشر/بروكسي).
 *
 * لا تستخدمي هنا `…supabase.co/auth/v1/callback` — ذلك الرابط لـ Google Cloud (Authorized redirect URIs)
 * وليس لـ `signInWithOAuth({ options.redirectTo })`. انظري `getSupabaseOAuthProviderRedirectUri()`.
 */
export function getOAuthRedirectTo(): string {
  if (typeof window === 'undefined') return ''
  const override = import.meta.env.VITE_AUTH_REDIRECT_URL
  if (typeof override === 'string' && override.trim().length > 0) return override.trim()
  return `${window.location.origin}/auth/callback`
}

/**
 * استخراج `code` من الاستعلام أو الهاش — يطابق سلوك GoTrue (`search` له أولوية على `hash`).
 */
export function extractOAuthCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const u = new URL(window.location.href)
    const fromSearch = u.searchParams.get('code')
    if (fromSearch) return fromSearch
    const hash = u.hash.startsWith('#') ? u.hash.slice(1) : ''
    return new URLSearchParams(hash).get('code')
  } catch {
    return null
  }
}

/** رسالة عربية مفهومة من خطأ Supabase أو عنوان الرجوع */
export function describeOAuthFailure(err: AuthError | Error | string | null | undefined): string {
  const raw = typeof err === 'string' ? err : err?.message ?? ''
  const lower = raw.toLowerCase()
  if (!raw.trim()) return 'تعذر تسجيل الدخول'
  if (lower.includes('access_denied') || lower.includes('user denied')) return 'تم إلغاء تسجيل الدخول'
  if (lower.includes('not enabled') || (lower.includes('provider') && lower.includes('disabled')))
    return 'هذا المزوّد غير مفعّل حالياً. جرّبي البريد أو رقم الجوال، أو راجعي إعدادات المشروع في Supabase.'
  if (lower.includes('popup') || lower.includes('closed')) return 'تم إغلاق نافذة تسجيل الدخول'
  if (isRedirectUriMismatchMessage(raw)) {
    const u = getSupabaseOAuthProviderRedirectUri()
    if (u) {
      return `redirect_uri_mismatch: Add this exact URL in Google Cloud (OAuth client → Authorized redirect URIs) and Apple (Services ID → Return URLs): ${u} — أضفّي نفس الرابط في إعدادات Google وApple (رابط Supabase وليس رابط التطبيق).`
    }
    return 'redirect_uri_mismatch: In Google Cloud / Apple Developer, allow https://YOUR_PROJECT.supabase.co/auth/v1/callback (Supabase callback, not your app URL).'
  }
  return raw
}
