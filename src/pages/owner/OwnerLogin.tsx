import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import { colors } from '@/theme/colors'

export default function OwnerLogin() {
  const nav = useNavigate()
  const { isSalonPortal, isAdmin, loading, user } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user && (isSalonPortal || isAdmin)) nav('/salon/dashboard', { replace: true })
  }, [loading, user, isSalonPortal, isAdmin, nav])

  const start = () => {
    sessionStorage.setItem('rosera_verify_target', 'owner')
    nav('/auth')
  }

  if (loading || (user && (isSalonPortal || isAdmin))) return null

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] dark:from-rosera-dark dark:to-rosera-dark"
      style={{
        backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${colors.primary} 35%, ${colors.background}), color-mix(in srgb, ${colors.secondary} 90%, ${colors.primary}))`,
      }}
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-8 shadow-xl dark:border-primary/20 dark:bg-card">
        <h1 className="text-center text-2xl font-extrabold text-primary">دخول مالك الصالون</h1>
        <p className="mt-3 text-center text-sm text-rosera-gray">
          سجّلي دخولك برقم الجوال كما في تطبيق العملاء. بعد التحقق ستُوجَّهين إلى لوحة تحكم صالونك.
        </p>
        <Button
          className="mt-8 h-12 w-full rounded-2xl gradient-primary font-bold"
          onClick={start}
        >
          متابعة برقم الجوال
        </Button>
      </div>
    </div>
  )
}
