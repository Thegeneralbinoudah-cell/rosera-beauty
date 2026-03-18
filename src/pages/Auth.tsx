import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { STORAGE_KEYS } from '@/lib/utils'

function normalizeSaudiPhone(digits: string): string | null {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('966')) {
    const rest = d.slice(3)
    if (rest.length === 9 && rest.startsWith('5')) return `+966${rest}`
    return null
  }
  if (d.length === 9 && d.startsWith('5')) return `+966${d}`
  if (d.length === 10 && d.startsWith('05')) return `+966${d.slice(1)}`
  return null
}

export default function Auth() {
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const fullPhone = normalizeSaudiPhone(phone)

  const onPhone = async () => {
    if (!fullPhone) {
      toast.error('أدخلي رقم جوال سعودي صحيح (مثال: 5xxxxxxxx)')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
      if (error) throw error
      toast.success('تم إرسال رمز التحقق')
      nav('/verify-otp', { state: { phone: fullPhone } })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرسال')
    } finally {
      setLoading(false)
    }
  }

  const guest = () => {
    localStorage.setItem(STORAGE_KEYS.guest, '1')
    nav('/home', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#fdf2f8] via-white to-[#f3e8ff] px-6 py-12 dark:from-rosera-dark dark:via-rosera-dark dark:to-rosera-dark">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-primary/10 bg-white/80 p-8 shadow-soft backdrop-blur dark:bg-card/90">
          <div className="text-center">
            <span className="text-5xl">🌸</span>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">مرحباً بكِ</h1>
            <p className="mt-2 text-sm text-rosera-gray">تسجيل الدخول برقم الجوال فقط — سنرسل لكِ رمز التحقق</p>
          </div>

          <div className="mt-10 space-y-4">
            <Label className="text-foreground">رقم الجوال</Label>
            <div className="flex gap-2">
              <div className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/10 px-4 dark:bg-card">
                <span>🇸🇦</span>
                <span className="text-sm font-bold text-primary" dir="ltr">
                  +966
                </span>
              </div>
              <Input
                dir="ltr"
                className="h-12 flex-1 rounded-2xl border-primary/20 text-left text-lg tracking-wide"
                placeholder="5xxxxxxxx"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-xs text-rosera-gray">الصيغة: +966 ثم 9 أرقام تبدأ بـ 5</p>
            <Button
              className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg shadow-primary/25"
              onClick={onPhone}
              disabled={loading}
            >
              إرسال رمز التحقق
            </Button>

            <button
              type="button"
              onClick={guest}
              className="w-full pt-6 text-center text-sm font-semibold text-primary"
            >
              تخطي وتصفحي كضيفة
            </button>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-rosera-gray">
              <Link to="/privacy" className="hover:text-primary">سياسة الخصوصية</Link>
              <Link to="/terms" className="hover:text-primary">الشروط والأحكام</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
