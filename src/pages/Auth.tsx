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
import { useI18n } from '@/hooks/useI18n'

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
  const { t: tr } = useI18n()
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

  return (
    <div className="min-h-dvh bg-white px-6 py-12 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-rose-200 p-8 shadow-soft dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
          <div className="mb-3 flex justify-end">
            <PreferencesToggle />
          </div>
          <div className="text-center">
            <img
              src={ROSERA_LOGO_SRC}
              alt={lang === 'ar' ? 'روزيرا' : 'Rosera'}
              width={120}
              className="mx-auto block h-auto w-[120px] max-w-full object-contain"
            />
            <h1 className="mt-4 text-2xl font-extrabold text-gray-900 dark:text-white">{ui.title}</h1>
          </div>

          <OAuthSocialButtons disabled={loadingPhone || loadingVerify || loadingEmail} />

          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                {tr('auth.orDivider')}
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <Label className="text-gray-900 dark:text-white">{ui.phone}</Label>
            <div className="flex gap-2">
              <div className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 dark:border-gray-700 dark:bg-gray-800">
                <span>🇸🇦</span>
                <span className="text-sm font-bold text-primary" dir="ltr">
                  +966
                </span>
              </div>
              <Input
                dir="ltr"
                className="h-12 flex-1 rounded-2xl border-gray-200 bg-gray-50 text-left text-lg tracking-wide text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="5xxxxxxxx"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={phoneOtpSent}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ui.format}</p>
            {!phoneOtpSent ? (
              <Button
                className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg shadow-primary/25"
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
                <Label className="text-gray-900 dark:text-white">{ui.otpLabel}</Label>
                <Input
                  dir="ltr"
                  className="h-12 rounded-2xl border-gray-200 bg-gray-50 text-center text-2xl tracking-[0.5em] text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="••••••"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button
                  className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold shadow-lg shadow-primary/25"
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
                  className="w-full text-center text-sm font-semibold text-primary"
                  onClick={() => {
                    setPhoneOtpSent(false)
                    setOtpCode('')
                  }}
                >
                  {lang === 'ar' ? 'تعديل الرقم' : 'Change number'}
                </button>
              </>
            )}

            <form
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              autoComplete="on"
              onSubmit={(e) => {
                e.preventDefault()
                void onEmailLogin()
              }}
            >
              <p className="mb-3 text-sm font-bold text-gray-900 dark:text-white">{ui.emailLogin}</p>
              <div className="space-y-2">
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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
                    className="h-11 rounded-xl border-gray-200 bg-gray-50 pe-11 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-gray-700"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                variant="outline"
                className="mt-3 h-11 w-full rounded-xl border-primary/25"
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
              <Link to="/auth/email" className="mt-2 block text-center text-xs font-semibold text-primary hover:underline">
                إنشاء حساب جديد / خيارات متقدمة
              </Link>
            </form>
            <button
              type="button"
              onClick={guest}
              className="w-full pt-4 text-center text-sm font-semibold text-primary"
            >
              {ui.guest}
            </button>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <Link to="/privacy" className="hover:text-primary">سياسة الخصوصية</Link>
              <Link to="/terms" className="hover:text-primary">الشروط والأحكام</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
