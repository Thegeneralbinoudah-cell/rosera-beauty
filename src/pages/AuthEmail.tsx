import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

/** بعد تسجيل الدخول بالإيميل: توجيه حسب الدور من profiles */
async function redirectAfterEmailLogin(nav: (path: string, opts?: { replace: boolean }) => void, uid: string) {
  const { data: prof } = await supabase.from('profiles').select('role, full_name').eq('id', uid).single()
  const p = prof as { role?: string; full_name?: string } | null
  const role = (p?.role ?? 'user').toLowerCase()

  if (role === 'owner') {
    nav('/owner', { replace: true })
    return
  }
  if (role === 'admin' || role === 'supervisor') {
    nav('/admin', { replace: true })
    return
  }
  if (p?.full_name?.trim()) {
    nav('/home', { replace: true })
  } else {
    nav('/complete-profile', { replace: true })
  }
}

export default function AuthEmail() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupSent, setSignupSent] = useState(false)

  const onLogin = async () => {
    if (!email.trim()) {
      toast.error('أدخلي البريد الإلكتروني')
      return
    }
    if (!password) {
      toast.error('أدخلي كلمة المرور')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      const uid = data.user?.id
      if (uid) {
        toast.success('تم تسجيل الدخول')
        await redirectAfterEmailLogin(nav, uid)
      } else {
        nav('/home', { replace: true })
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  const onSignUp = async () => {
    if (!email.trim()) {
      toast.error('أدخلي البريد الإلكتروني')
      return
    }
    if (password.length < 6) {
      toast.error('كلمة المرور 6 أحرف على الأقل')
      return
    }
    if (password !== confirmPassword) {
      toast.error('تأكيد كلمة المرور غير متطابق')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/email` },
      })
      if (error) throw error
      setSignupSent(true)
      toast.success('تم إرسال رسالة التحقق إلى بريدكِ — فعّلي الحساب من الرابط ثم سجّلي الدخول')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل إنشاء الحساب')
    } finally {
      setLoading(false)
    }
  }

  const submit = mode === 'login' ? onLogin : onSignUp

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#fdf2f8] via-white to-[#f3e8ff] px-6 py-12 dark:from-rosera-dark dark:via-rosera-dark dark:to-rosera-dark">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-primary/10 bg-white/80 p-8 shadow-soft backdrop-blur dark:bg-card/90">
          <div className="text-center">
            <span className="text-5xl">✉️</span>
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">
              {mode === 'login' ? 'تسجيل الدخول بالإيميل' : 'إنشاء حساب جديد'}
            </h1>
            <p className="mt-2 text-sm text-rosera-gray">
              {mode === 'login'
                ? 'أدخلي بريدكِ وكلمة المرور للدخول'
                : 'أنشئي حساباً بالبريد الإلكتروني وكلمة المرور'}
            </p>
          </div>

          {signupSent ? (
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                تحققي من بريدكِ واتبعي رابط التحقق لتفعيل الحساب، ثم ارجعي وسجّلي الدخول من هذه الصفحة.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSignupSent(false)
                  setMode('login')
                }}
              >
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-10 space-y-4">
                <div>
                  <Label className="text-foreground">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    dir="ltr"
                    className="mt-2 h-12 rounded-2xl border-primary/20"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-foreground">كلمة المرور</Label>
                  <Input
                    type="password"
                    className="mt-2 h-12 rounded-2xl border-primary/20"
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {mode === 'signup' && (
                  <div>
                    <Label className="text-foreground">تأكيد كلمة المرور</Label>
                    <Input
                      type="password"
                      className="mt-2 h-12 rounded-2xl border-primary/20"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}
                {mode === 'login' && (
                  <div className="text-left">
                    <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                      نسيتِ كلمة المرور؟
                    </Link>
                  </div>
                )}
                <Button
                  className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg shadow-primary/25"
                  onClick={submit}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري المعالجة...
                    </span>
                  ) : mode === 'login' ? (
                    'تسجيل الدخول'
                  ) : (
                    'إنشاء الحساب'
                  )}
                </Button>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => nav('/auth', { replace: true })}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white py-3 text-sm font-semibold text-foreground hover:bg-primary/5 dark:bg-card"
                >
                  📱 الدخول بالجوال
                </button>
                <p className="text-center text-sm text-rosera-gray">
                  {mode === 'login' ? (
                    <>
                      ليس لديكِ حساب؟{' '}
                      <button
                        type="button"
                        className="font-bold text-primary hover:underline"
                        onClick={() => {
                          setMode('signup')
                          setSignupSent(false)
                        }}
                      >
                        إنشاء حساب جديد
                      </button>
                    </>
                  ) : (
                    <>
                      لديكِ حساب؟{' '}
                      <button
                        type="button"
                        className="font-bold text-primary hover:underline"
                        onClick={() => setMode('login')}
                      >
                        تسجيل الدخول
                      </button>
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-rosera-gray">
            <Link to="/privacy" className="hover:text-primary">
              سياسة الخصوصية
            </Link>
            <Link to="/terms" className="hover:text-primary">
              الشروط والأحكام
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
