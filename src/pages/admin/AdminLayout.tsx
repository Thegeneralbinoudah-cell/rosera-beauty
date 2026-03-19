import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Building2,
  Users,
  Calendar,
  Star,
  BarChart3,
  LogOut,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const links = [
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/admin/salons', label: 'الصالونات', icon: Building2 },
  { to: '/admin/users', label: 'المستخدمون', icon: Users },
  { to: '/admin/bookings', label: 'الحجوزات', icon: Calendar },
  { to: '/admin/reviews', label: 'التقييمات', icon: Star },
  { to: '/admin/revenue', label: 'الإيرادات', icon: Wallet },
  { to: '/admin/analytics', label: 'التحليلات', icon: BarChart3 },
]

export default function AdminLayout() {
  const { isAdmin, loading, signOut } = useAuth()
  const nav = useNavigate()
  if (loading) return <div className="flex min-h-dvh items-center justify-center p-8">جاري التحميل…</div>
  if (!isAdmin) return <Navigate to="/admin/login" replace />

  const logout = async () => {
    await signOut()
    nav('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh bg-rosera-light pb-20 md:pb-0 dark:bg-rosera-dark" dir="rtl">
      <aside className="hidden w-56 shrink-0 border-e bg-white pt-[max(1rem,env(safe-area-inset-top))] p-4 dark:bg-card md:block">
        <h2 className="mb-6 font-bold text-primary">روزيرا أدمن</h2>
        <nav className="space-y-1">
          {links.map(({ to, label, icon: Icon, end }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" className="mt-6 w-full justify-start gap-2 text-destructive" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </aside>
      <main className="flex-1 overflow-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-8">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around border-t bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden dark:bg-card">
        {links.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
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
            {label.split(' ')[0]}
          </NavLink>
        ))}
        <button type="button" onClick={() => void logout()} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold text-destructive">
          <LogOut className="h-5 w-5" />
          خروج
        </button>
      </nav>
    </div>
  )
}
