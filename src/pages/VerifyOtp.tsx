import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const DIGITS = 4

export default function VerifyOtp() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { phone?: string } }
  const phone = loc.state?.phone ?? ''
  const [digits, setDigits] = useState<string[]>(() => Array(DIGITS).fill(''))
  const [sec, setSec] = useState(60)
  const [loading, setLoading] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!phone) {
      nav('/auth', { replace: true })
      return
    }
    const t = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [phone, nav])

  const code = digits.join('')

  const verify = async () => {
    if (code.length !== DIGITS) {
      toast.error('أدخلي الرمز كاملاً (4 أرقام)')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, otp: code },
      })
      if (error) throw error
      const d = data as {
        error?: string
        access_token?: string
        refresh_token?: string
      }
      if (d.error || !d.access_token) {
        toast.error('رمز التحقق غير صحيح')
        return
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: d.access_token,
        refresh_token: d.refresh_token ?? '',
      })
      if (sessErr) throw sessErr
      toast.success('تم التحقق بنجاح')
      const uid = (await supabase.auth.getUser()).data.user?.id
      const target = sessionStorage.getItem('rosera_verify_target')
      sessionStorage.removeItem('rosera_verify_target')

      if (uid && target === 'owner') {
        const [{ data: so }, { data: biz }] = await Promise.all([
          supabase.from('salon_owners').select('id').eq('user_id', uid).limit(1).maybeSingle(),
          supabase.from('businesses').select('id').eq('owner_id', uid).limit(1).maybeSingle(),
        ])
        if (so || biz) {
          nav('/owner', { replace: true })
        } else {
          toast.error('حسابك غير مرتبط بصالون')
          nav('/home', { replace: true })
        }
        return
      }

      if (uid && target === 'admin') {
        const { data: adm } = await supabase.from('admins').select('id').eq('user_id', uid).maybeSingle()
        const { data: profAdm } = await supabase.from('profiles').select('role, email').eq('id', uid).single()
        const p = profAdm as { role?: string; email?: string } | null
        if (adm || p?.role === 'admin' || p?.email === 'admin@rosera.com') {
          nav('/admin', { replace: true })
        } else {
          toast.error('ليس لديك صلاحية مسؤول')
          nav('/home', { replace: true })
        }
        return
      }

      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', uid).single()
        if ((prof as { full_name?: string } | null)?.full_name?.trim()) {
          nav('/home', { replace: true })
        } else {
          nav('/complete-profile', { replace: true })
        }
      } else {
        nav('/complete-profile', { replace: true })
      }
    } catch {
      toast.error('رمز التحقق غير صحيح')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (sec > 0) return
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone } })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      setSec(60)
      toast.success('أُعيد إرسال الرمز')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرسال')
    }
  }

  const setD = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < DIGITS - 1) refs.current[i + 1]?.focus()
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-[#fce4ec] via-[#f3e5f5] to-[#e1bee7] px-6 py-12 dark:from-[#1a0a14] dark:via-rosera-dark dark:to-[#1a0a28]">
      <div className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full bg-[#E91E8C]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -end-24 h-72 w-72 rounded-full bg-[#9C27B0]/25 blur-3xl" />

      <div className="relative mx-auto max-w-md">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_20px_60px_-15px_rgba(233,30,140,0.25)] backdrop-blur-md dark:border-primary/20 dark:bg-card/95">
          <div className="mb-2 text-center text-4xl">💜</div>
          <h1 className="text-center text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            رمز التحقق
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-rosera-gray">
            أرسلنا رمزاً مكوّناً من 4 أرقام إلى
            <br />
            <span className="font-bold text-foreground" dir="ltr">
              {phone}
            </span>
          </p>

          <div className="mt-10 flex justify-center gap-3" dir="ltr">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el
                }}
                className="h-14 w-12 rounded-2xl border-2 border-[#E91E8C]/35 bg-white text-center text-2xl font-bold shadow-inner transition focus:border-[#9C27B0] focus:ring-2 focus:ring-[#9C27B0]/30 dark:bg-card"
                maxLength={1}
                value={d}
                onChange={(e) => setD(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
                }}
              />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-rosera-gray">
            {sec > 0 ? `إعادة الإرسال خلال ${sec} ثانية` : 'يمكنكِ طلب رمز جديد'}
          </p>
          <button
            type="button"
            disabled={sec > 0}
            onClick={resend}
            className={`mt-2 w-full text-center text-sm font-bold ${sec > 0 ? 'text-rosera-gray' : 'text-[#9C27B0]'}`}
          >
            إعادة إرسال الرمز
          </button>

          <Button
            className="mt-8 h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg"
            onClick={verify}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري التحقق...
              </span>
            ) : (
              'تحقق والمتابعة'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
