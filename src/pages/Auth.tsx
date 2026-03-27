import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Mail, Eye, EyeOff } from 'lucide-react'
import { ROSERA_LOGO_SRC } from '@/lib/branding'
import { supabase } from '@/lib/supabase'
import { getEdgeFunctionErrorMessage } from '@/lib/edgeInvoke'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { STORAGE_KEYS } from '@/lib/utils'
import { runPostAuthRedirect } from '@/lib/postAuthRedirect'
import { consumePostAuthPath } from '@/lib/salonAcquisition'
import { isPrivilegedStaffClient } from '@/lib/privilegedStaff'
import { usePreferences } from '@/contexts/PreferencesContext'
import PreferencesToggle from '@/components/PreferencesToggle'
import { OAuthSocialButtons } from '@/components/auth/OAuthSocialButtons'
import { FallingPetals } from '@/components/animations/FallingPetals'

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
  const { lang } = usePreferences()
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingPhone, setLoadingPhone] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [loadingVerify, setLoadingVerify] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const fullPhone = normalizeSaudiPhone(phone)
  const ui = {
    title: lang === 'ar' ? 'مرحباً بك' : 'Welcome',
    phone: lang === 'ar' ? 'رقم الجوال' : 'Phone number',
    format: lang === 'ar' ? 'الصيغة: +966 ثم 9 أرقام تبدأ بـ 5' : 'Format: +966 then 9 digits starting with 5',
    sendOtp: lang === 'ar' ? 'إرسال رمز التحقق' : 'Send OTP',
    otpLabel: lang === 'ar' ? 'رمز التحقق (6 أرقام)' : 'Verification code (6 digits)',
    verify: lang === 'ar' ? 'تحقق' : 'Verify',
    verifying: lang === 'ar' ? 'جاري التحقق...' : 'Verifying...',
    emailLogin: lang === 'ar' ? 'الدخول بالإيميل وكلمة المرور' : 'Email and password login',
    emailBtn: lang === 'ar' ? 'دخول بالإيميل' : 'Sign in with email',
    guest: lang === 'ar' ? 'تخطي وتصفحي كضيفة' : 'Continue as guest',
  }

  const redirectAfterPhoneAuth = async () => {
    await runPostAuthRedirect(nav)
  }

  const onPhone = async () => {
    if (!fullPhone) {
      toast.error('أدخلي رقم جوال سعودي صحيح (مثال: 5xxxxxxxx)')
      return
    }
    setLoadingPhone(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: fullPhone },
      })
      if (error) throw new Error(getEdgeFunctionErrorMessage(error, data))
      const errMsg = (data as { error?: string })?.error
      if (errMsg) throw new Error(errMsg)
      toast.success('تم إرسال رمز التحقق')
      setPhoneOtpSent(true)
      setOtpCode('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإرسال')
    } finally {
      setLoadingPhone(false)
    }
  }

  const onVerifyOtp = async () => {
    const code = otpCode.replace(/\D/g, '').slice(0, 6)
    if (code.length !== 6) {
      toast.error(lang === 'ar' ? 'أدخلي الرمز كاملاً (6 أرقام)' : 'Enter all 6 digits')
      return
    }
    if (!fullPhone) {
      toast.error('رقم الجوال غير صالح')
      return
    }
    setLoadingVerify(true)
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: fullPhone, code },
      })
      if (error) throw new Error(getEdgeFunctionErrorMessage(error, data))
      const d = data as {
        success?: boolean
        error?: string
        access_token?: string
        refresh_token?: string
      }
      if (!d.success || d.error || !d.access_token) {
        toast.error(d.error ?? 'رمز غير صحيح أو منتهي')
        return
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: d.access_token,
        refresh_token: d.refresh_token ?? '',
      })
      if (sessErr) throw sessErr
      toast.success(lang === 'ar' ? 'تم التحقق بنجاح' : 'Verified')
      await redirectAfterPhoneAuth()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'رمز غير صحيح أو منتهي')
    } finally {
      setLoadingVerify(false)
    }
  }

  const onEmailLogin = async () => {
    if (!email.trim()) return toast.error('أدخلي البريد الإلكتروني')
    if (!password) return toast.error('أدخلي كلمة المرور')
    setLoadingEmail(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      const uid = data.user?.id
      if (uid) {
        /** Self-only: RLS allows select where id = auth.uid() */
        const [{ data: adm }, { data: prof }] = await Promise.all([
          supabase.from('admins').select('id').eq('user_id', uid).maybeSingle(),
          supabase.from('profiles').select('role, full_name, email').eq('id', uid).single(),
        ])
        const role = ((prof as { role?: string } | null)?.role ?? 'user').toLowerCase()
        if (role === 'owner') return nav('/salon/dashboard', { replace: true })
        if (
          isPrivilegedStaffClient({
            isAdminFromAdminsTable: !!adm,
            profile: prof as { role?: string; email?: string } | null,
          })
        )
          return nav('/admin', { replace: true })
        const postAuth = consumePostAuthPath()
        if (postAuth) return nav(postAuth, { replace: true })
        return nav('/home', { replace: true })
      }
      nav('/home', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل تسجيل الدخول')
    } finally {
      setLoadingEmail(false)
    }
  }

  const guest = () => {
    localStorage.setItem(STORAGE_KEYS.guest, '1')
    nav('/home', { replace: true })
  }

  const underlineInput = 'auth-input-underline h-12 rounded-none text-lg font-light text-foreground'

  return (
    <div className="luxury-page-canvas relative min-h-dvh px-6 py-6">
      <FallingPetals />
      <div className="relative z-10 mx-auto max-w-md">
        <div className="rounded-[20px] border border-primary/20 bg-card p-8 shadow-[0_8px_32px_rgba(139,26,74,0.2)]">
          <div className="mb-3 flex justify-end">
            <PreferencesToggle />
          </div>
          <div className="text-center">
            <img
              src={ROSERA_LOGO_SRC}
              alt={lang === 'ar' ? 'روزيرا' : 'Rosera'}
              width={120}
              className="auth-logo-breathe mx-auto block h-auto w-[120px] max-w-full object-contain"
            />
            <h1 className="mt-6 font-serif text-2xl font-normal tracking-wide text-foreground">{ui.title}</h1>
          </div>

          <div className="mt-8 space-y-8">
            <section className="space-y-4">
              <Label className="text-sm font-normal text-muted-foreground">{ui.phone}</Label>
              <div className="flex items-end gap-3">
                <div className="flex h-12 shrink-0 items-center gap-2 px-1 text-accent" dir="ltr">
                  <span aria-hidden>🇸🇦</span>
                  <span className="text-sm font-light tracking-wide">+966</span>
                </div>
                <Input
                  dir="ltr"
                  className={`${underlineInput} min-w-0 flex-1`}
                  placeholder="5xxxxxxxx"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={phoneOtpSent}
                />
              </div>
              <p className="text-xs font-light text-muted-foreground">{ui.format}</p>
              {!phoneOtpSent ? (
                <Button
                  className="h-12 w-full text-base font-normal shadow-[0_4px_24px_rgba(139,26,74,0.35)]"
                  onClick={onPhone}
                  disabled={loadingPhone}
                >
                  {loadingPhone ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الإرسال...
                    </span>
                  ) : (
                    ui.sendOtp
                  )}
                </Button>
              ) : (
                <>
                  <Label className="text-sm font-normal text-muted-foreground">{ui.otpLabel}</Label>
                  <Input
                    dir="ltr"
                    className={`${underlineInput} text-center text-2xl tracking-[0.5em]`}
                    placeholder="••••••"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <Button
                    className="h-12 w-full text-base font-normal shadow-[0_4px_24px_rgba(139,26,74,0.35)]"
                    onClick={onVerifyOtp}
                    disabled={loadingVerify}
                  >
                    {loadingVerify ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {ui.verifying}
                      </span>
                    ) : (
                      ui.verify
                    )}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-sm font-normal text-accent"
                    onClick={() => {
                      setPhoneOtpSent(false)
                      setOtpCode('')
                    }}
                  >
                    {lang === 'ar' ? 'تعديل الرقم' : 'Change number'}
                  </button>
                </>
              )}
            </section>

            <form
              className="space-y-4 rounded-[20px] border border-primary/20 bg-muted/50 p-5"
              autoComplete="on"
              onSubmit={(e) => {
                e.preventDefault()
                void onEmailLogin()
              }}
            >
              <p className="text-sm font-normal text-foreground">{ui.emailLogin}</p>
              <div className="space-y-1">
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  className="auth-input-underline h-11 font-light"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="relative">
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
                    className="auth-input-underline h-11 pe-11 font-light"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute end-0 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/90"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                variant="secondary"
                className="mt-1 h-11 w-full border-accent bg-transparent text-accent hover:bg-muted/80"
                disabled={loadingEmail}
              >
                {loadingEmail ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الدخول...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Mail className="h-4 w-4" aria-hidden />
                    {ui.emailBtn}
                  </span>
                )}
              </Button>
              <Link
                to="/auth/email"
                className="mt-2 block text-center text-xs font-normal text-accent underline-offset-4 hover:underline"
              >
                إنشاء حساب جديد / خيارات متقدمة
              </Link>
            </form>

            <div className="relative flex items-center gap-2" aria-hidden>
              <span className="h-px flex-1 bg-primary/25" />
              <span
                className="shrink-0 text-[13px] font-medium text-muted-foreground"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                {lang === 'ar' ? '── أو ──' : '— or —'}
              </span>
              <span className="h-px flex-1 bg-primary/25" />
            </div>

            <OAuthSocialButtons disabled={loadingPhone || loadingVerify || loadingEmail} />

            <button
              type="button"
              onClick={guest}
              className="w-full pt-2 text-center text-sm font-normal text-accent"
            >
              {ui.guest}
            </button>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/privacy" className="text-accent hover:text-accent/90">
                سياسة الخصوصية
              </Link>
              <Link to="/terms" className="text-accent hover:text-accent/90">
                الشروط والأحكام
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
