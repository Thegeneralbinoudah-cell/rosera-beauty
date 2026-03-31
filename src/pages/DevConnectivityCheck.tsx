/**
 * صفحة تشخيص — تظهر فقط في وضع التطوير.
 * تساعد على كسر حلقة «Failed to fetch» بدون تخمين: هل env صحيح؟ هل Supabase يستجيب؟
 */
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type PingState = 'idle' | 'loading' | 'ok' | 'fail'

export default function DevConnectivityCheck() {
  if (!import.meta.env.DEV) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-foreground">
        غير متاح في الإنتاج.
      </div>
    )
  }

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''
  const keyHint =
    key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)} (طول ${key.length})` : key ? 'قصير جداً' : 'فاضي'

  const [authHealth, setAuthHealth] = useState<PingState>('idle')
  const [authDetail, setAuthDetail] = useState('')
  const [restPing, setRestPing] = useState<PingState>('idle')
  const [restDetail, setRestDetail] = useState('')

  const pingAuth = useCallback(async () => {
    setAuthHealth('loading')
    setAuthDetail('')
    try {
      const base = url.replace(/\/$/, '')
      const res = await fetch(`${base}/auth/v1/health`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      const text = await res.text()
      setAuthHealth(res.ok ? 'ok' : 'fail')
      setAuthDetail(`HTTP ${res.status} — ${text.slice(0, 200)}`)
    } catch (e) {
      setAuthHealth('fail')
      setAuthDetail(e instanceof Error ? e.message : String(e))
    }
  }, [url, key])

  const pingRest = useCallback(async () => {
    setRestPing('loading')
    setRestDetail('')
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error) {
        setRestPing('fail')
        setRestDetail(`${error.message} (code: ${error.code ?? '—'})`)
        return
      }
      setRestPing('ok')
      setRestDetail('طلب profiles نجح (حتى لو الجدول فاضي).')
    } catch (e) {
      setRestPing('fail')
      setRestDetail(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-start text-foreground" dir="rtl">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">تشخيص الاتصال (تطوير فقط)</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            إذا ظهر هنا فشل، السبب غالباً إعدادات Supabase أو الشبكة — مو «روزي» وحدها.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2 text-sm">
          <p>
            <span className="font-bold text-foreground">المجلد:</span> شغّلي دائماً من مجلد فيه{' '}
            <code className="rounded bg-muted px-1">package.json</code> (مثلاً <code className="rounded bg-muted px-1">~/Projects/rosera</code>).
          </p>
          <p>
            <span className="font-bold text-foreground">بعد تعديل .env:</span> أوقفي السيرفر و<code className="rounded bg-muted px-1">npm run dev</code> من جديد.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h2 className="font-bold text-foreground">متغيرات Vite (عميل)</h2>
          <p className="text-sm break-all">
            <span className="text-muted-foreground">VITE_SUPABASE_URL:</span>{' '}
            {url || <span className="text-destructive">فاضي — هذا يكسر التطبيق</span>}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">VITE_SUPABASE_ANON_KEY:</span> {keyHint}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">isSupabaseConfigured:</span>{' '}
            <span className={isSupabaseConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
              {String(isSupabaseConfigured)}
            </span>
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
          <h2 className="font-bold text-foreground">اختبار الشبكة</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              onClick={() => void pingAuth()}
              disabled={!url || !key || authHealth === 'loading'}
            >
              فحص Auth /health
            </button>
            <button
              type="button"
              className="rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm font-bold text-foreground"
              onClick={() => void pingRest()}
              disabled={!isSupabaseConfigured || restPing === 'loading'}
            >
              فحص REST (profiles)
            </button>
          </div>
          <div className="space-y-2 text-xs font-mono text-muted-foreground">
            <p>
              Auth:{' '}
              <span className="text-foreground">
                {authHealth === 'idle' && 'لم يُجرَ'}
                {authHealth === 'loading' && '…'}
                {authHealth === 'ok' && '✓ نجح'}
                {authHealth === 'fail' && '✗ فشل'}
              </span>
            </p>
            {authDetail ? <p className="whitespace-pre-wrap break-all text-foreground">{authDetail}</p> : null}
            <p>
              REST:{' '}
              <span className="text-foreground">
                {restPing === 'idle' && 'لم يُجرَ'}
                {restPing === 'loading' && '…'}
                {restPing === 'ok' && '✓ نجح'}
                {restPing === 'fail' && '✗ فشل'}
              </span>
            </p>
            {restDetail ? <p className="whitespace-pre-wrap break-all text-foreground">{restDetail}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          <p className="font-bold">لو Auth فشل بـ Failed to fetch:</p>
          <ul className="mt-2 list-disc pe-5 space-y-1 text-muted-foreground">
            <li>تأكدي مشروع Supabase مو «Paused» من لوحة التحكم.</li>
            <li>تأكدي الرابط يبدأ بـ https وينتهي بـ .supabase.co</li>
            <li>عطّلي VPN / أدوات حجب مؤقتاً.</li>
          </ul>
        </section>

        <Link to="/" className="inline-block text-sm font-bold text-primary underline">
          → العودة للبداية
        </Link>
      </div>
    </div>
  )
}
