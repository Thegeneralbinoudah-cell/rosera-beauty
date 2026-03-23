import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { ROSERA_LOGO_SRC } from '@/lib/branding'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import PreferencesToggle from '@/components/PreferencesToggle'

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
  const { t } = useI18n()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupSent, setSignupSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
    <div className="min-h-dvh bg-white px-6 py-12 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-soft dark:border-primary/20 dark:bg-card">
          <div className="mb-3 flex justify-end">
            <PreferencesToggle />
          </div>
          <div className="text-center">
            <img src={ROSERA_LOGO_SRC} alt="" className="mx-auto w-18 h-18 rounded-2xl object-contain" />
            <h1 className="mt-4 text-2xl font-extrabold text-foreground">
              {mode === 'login' ? t('authEmail.loginTitle') : t('authEmail.signupTitle')}
            </h1>
            <p className="mt-2 text-sm text-rosera-gray">
              {mode === 'login'
                ? t('authEmail.loginSub')
                : t('authEmail.signupSub')}
            </p>
          </div>

          {signupSent ? (
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {t('authEmail.checkMail')}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSignupSent(false)
                  setMode('login')
                }}
              >
                {t('authEmail.backToLogin')}
              </Button>
            </div>
          ) : (
            <>
              <form
                className="mt-10 space-y-4"
                autoComplete="on"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit()
                }}
              >
                <div>
                  <Label className="text-foreground" htmlFor="auth-email-field">
                    {t('authEmail.email')}
                  </Label>
                  <Input
                    id="auth-email-field"
                    name="email"
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
                  <Label className="text-foreground" htmlFor="auth-password-field">
                    {t('authEmail.password')}
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      id="auth-password-field"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className="h-12 rounded-2xl border-primary/20 pe-11"
                      placeholder="••••••••"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-rosera-gray hover:bg-primary/10"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                {mode === 'signup' && (
                  <div>
                    <Label className="text-foreground" htmlFor="auth-confirm-field">
                      {t('authEmail.confirmPassword')}
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="auth-confirm-field"
                        name="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        className="h-12 rounded-2xl border-primary/20 pe-11"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-rosera-gray hover:bg-primary/10"
                        onClick={() => setShowConfirm((s) => !s)}
                        aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}
                {mode === 'login' && (
                  <div className="text-left">
                    <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                      {t('authEmail.forgotPassword')}
                    </Link>
                  </div>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg shadow-primary/25"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('authEmail.processing')}
                    </span>
                  ) : mode === 'login' ? (
                    t('authEmail.login')
                  ) : (
                    t('authEmail.signup')
                  )}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => nav('/auth', { replace: true })}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-white py-3 text-sm font-semibold text-foreground hover:bg-primary/5 dark:bg-card"
                >
                  {t('authEmail.phoneLogin')}
                </button>
                <p className="text-center text-sm text-rosera-gray">
                  {mode === 'login' ? (
                    <>
                      {t('authEmail.noAccount')}{' '}
                      <button
                        type="button"
                        className="font-bold text-primary hover:underline"
                        onClick={() => {
                          setMode('signup')
                          setSignupSent(false)
                        }}
                      >
                        {t('authEmail.createAccount')}
                      </button>
                    </>
                  ) : (
                    <>
                      {t('authEmail.haveAccount')}{' '}
                      <button
                        type="button"
                        className="font-bold text-primary hover:underline"
                        onClick={() => setMode('login')}
                      >
                        {t('authEmail.login')}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-rosera-gray">
            <Link to="/privacy" className="hover:text-primary">
              {t('authEmail.privacy')}
            </Link>
            <Link to="/terms" className="hover:text-primary">
              {t('authEmail.terms')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
