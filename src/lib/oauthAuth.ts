import type { AuthError } from '@supabase/supabase-js'

/** مسار إرجاع OAuth — يجب تطابقه مع Supabase Dashboard → URL Configuration */
export function getOAuthRedirectTo(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/auth/callback`
}

/**
 * استخراج `code` من الاستعلام أو الهاش (بعض تدفقات OAuth).
 */
export function extractOAuthCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search).get('code')
  if (q) return q
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  return new URLSearchParams(hash).get('code')
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
  return raw
}
