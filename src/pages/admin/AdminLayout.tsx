import { useEffect, useState } from 'react'
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingBag,
  Truck,
  ShieldCheck,
  Users,
  UserCog,
  Calendar,
  Star,
  BarChart3,
  LogOut,
  Wallet,
  Smartphone,
  TrendingUp,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/useI18n'

type AdminNavLink = {
  to: string
  navKey: string
  icon: LucideIcon
  end?: boolean
}

const linkDefs: AdminNavLink[] = [
  { to: '/admin', navKey: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/salons', navKey: 'salons', icon: Building2 },
  { to: '/admin/products', navKey: 'products', icon: ShoppingBag },
  { to: '/admin/users', navKey: 'users', icon: Users },
  { to: '/admin/team', navKey: 'team', icon: UserCog },
  { to: '/admin/bookings', navKey: 'bookings', icon: Calendar },
  { to: '/admin/reviews', navKey: 'reviews', icon: Star },
  { to: '/admin/providers', navKey: 'providers', icon: Package },
  { to: '/admin/shipping', navKey: 'shipping', icon: Truck },
  { to: '/admin/trust-ops', navKey: 'trust', icon: ShieldCheck },
  { to: '/admin/revenue', navKey: 'revenue', icon: Wallet },
  { to: '/admin/monetization', navKey: 'monetization', icon: TrendingUp },
  { to: '/admin/analytics', navKey: 'analytics', icon: BarChart3 },
  { to: '/admin/offers', navKey: 'offers', icon: Gift },
]

const ROLE_KEYS = ['owner', 'admin', 'supervisor', 'user'] as const

export default function AdminLayout() {
  const { t } = useI18n()
  const { isAdmin, loading, signOut, profile } = useAuth()
  const nav = useNavigate()
  const [slaAlertsCount, setSlaAlertsCount] = useState(0)

  useEffect(() => {
    if (loading || !isAdmin) return
    let c = true
    async function loadSlaAlerts() {
      const { count } = await supabase
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .eq('sla_breached', true)
      if (c) setSlaAlertsCount(count ?? 0)
    }
    void loadSlaAlerts()
    const intervalId = window.setInterval(() => {
      void loadSlaAlerts()
    }, 30000)
    return () => {
      c = false
      window.clearInterval(intervalId)
    }
  }, [loading, isAdmin])

  if (loading) return <div className="flex min-h-dvh items-center justify-center p-8">{t('admin.loading')}</div>
  if (!isAdmin) return <Navigate to="/admin/login" replace />

  const logout = async () => {
    await signOut()
    nav('/admin/login', { replace: true })
  }

  const currentRole = (profile?.role ?? 'user').toLowerCase()
  const displayRole = (ROLE_KEYS as readonly string[]).includes(currentRole)
    ? t(`admin.role.${currentRole}`)
    : currentRole

  return (
    <div className="flex min-h-dvh bg-rosera-light pb-20 md:pb-0 dark:bg-rosera-dark" dir="rtl">
      <aside className="hidden w-56 shrink-0 border-e bg-white pt-[max(1rem,env(safe-area-inset-top))] p-4 dark:bg-card md:block">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold text-primary">{t('admin.title')}</h2>
          {slaAlertsCount > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-extrabold text-white">
              SLA {slaAlertsCount}
            </span>
          )}
        </div>
        {profile && (
          <div className="mb-4 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs">
            <p className="font-semibold text-foreground">{profile.full_name || profile.email || '—'}</p>
            <p className="text-muted-foreground">{displayRole}</p>
          </div>
        )}
        <nav className="space-y-1">
          {linkDefs.map(({ to, navKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
                  isActive ? 'bg-primary text-white' : 'text-rosera-gray hover:bg-muted'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {t(`admin.nav.${navKey}`)}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full justify-start gap-2 text-destructive" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          {t('admin.logout')}
        </Button>
        <Button variant="outline" className="mt-2 w-full justify-start gap-2" onClick={() => nav('/home')}>
          <Smartphone className="h-4 w-4" />
          {t('admin.viewApp')}
        </Button>
      </aside>
      <main className="flex-1 overflow-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-8">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around border-t bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden dark:bg-card">
        {linkDefs.slice(0, 5).map(({ to, navKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold',
                isActive ? 'text-primary' : 'text-rosera-gray'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {t(`admin.nav.mobile.${navKey}`)}
          </NavLink>
        ))}
        <button type="button" onClick={() => void logout()} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold text-destructive">
          <LogOut className="h-5 w-5" />
          {t('admin.logoutShort')}
        </button>
        <button type="button" onClick={() => nav('/home')} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold text-primary">
          <Smartphone className="h-5 w-5" />
          {t('admin.appShort')}
        </button>
      </nav>
    </div>
  )
}
