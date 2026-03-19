import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Scissors,
  Clock,
  BarChart3,
  CalendarHeart,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const links = [
  { to: '/owner', label: 'الرئيسية', end: true, icon: LayoutDashboard },
  { to: '/owner/bookings', label: 'الحجوزات', icon: CalendarHeart },
  { to: '/owner/services', label: 'الخدمات', icon: Scissors },
  { to: '/owner/schedule', label: 'الجدول', icon: Clock },
  { to: '/owner/reports', label: 'التقارير', icon: BarChart3 },
]

export default function OwnerLayout() {
  const { isSalonPortal, isAdmin, loading, signOut } = useAuth()
  const nav = useNavigate()
  if (loading) return <div className="flex min-h-dvh items-center justify-center p-8">جاري التحميل…</div>
  if (!isSalonPortal && !isAdmin) return <Navigate to="/owner/login" replace />

  const logout = async () => {
    await signOut()
    nav('/owner/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-20 md:pb-0 dark:bg-rosera-dark" dir="rtl">
      <aside className="fixed end-0 top-0 z-30 hidden h-full w-56 border-s bg-white pt-safe shadow-sm dark:bg-card md:block">
        <div className="border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 className="font-extrabold text-[#E91E8C]">لوحة الصالون</h2>
        </div>
        <nav className="space-y-1 p-3">
          {links.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                  isActive
                    ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white'
                    : 'text-rosera-gray hover:bg-muted'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <Button
            variant="ghost"
            className="mt-4 w-full justify-start gap-2 text-destructive"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </nav>
      </aside>

      <main className="md:me-56">
        <div className="mx-auto max-w-4xl p-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around border-t bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-lg md:hidden dark:bg-card">
        {links.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold',
                isActive ? 'text-[#E91E8C]' : 'text-rosera-gray'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-bold text-destructive"
        >
          <LogOut className="h-5 w-5" />
          خروج
        </button>
      </nav>
    </div>
  )
}
