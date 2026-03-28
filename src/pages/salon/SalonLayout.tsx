import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  CalendarHeart,
  Scissors,
  Sparkles,
  Megaphone,
  BarChart3,
  LogOut,
  Smartphone,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const nav = [
  { to: '/salon/dashboard', label: 'الرئيسية', end: true, icon: LayoutDashboard },
  { to: '/salon/bookings', label: 'الحجوزات', icon: CalendarHeart },
  { to: '/salon/services', label: 'الخدمات', icon: Scissors },
  { to: '/salon/subscription', label: 'الاشتراك', icon: Sparkles },
  { to: '/salon/ads', label: 'إعلان مميز', icon: Megaphone },
  { to: '/salon/analytics', label: 'التحليلات', icon: BarChart3 },
]

export default function SalonLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    navigate('/owner/login', { replace: true })
  }

  return (
    <div
      className="min-h-dvh bg-gradient-to-b from-background via-primary-subtle/40 to-primary-subtle/25 pb-[4.5rem] md:pb-0 dark:from-background dark:via-background dark:to-background"
      dir="rtl"
    >
      <aside className="fixed end-0 top-0 z-30 hidden h-full w-56 border-s border-primary/15 bg-white/95 pt-safe shadow-sm backdrop-blur-sm dark:border-border dark:bg-card md:block">
        <div className="border-b border-primary/15 p-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-border">
          <p className="text-xs font-semibold text-primary">Rosera</p>
          <h2 className="text-lg font-extrabold text-primary dark:text-primary">لوحة الصالون</h2>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                  isActive
                    ? 'bg-gradient-to-l from-primary-subtle to-primary/20 text-primary shadow-sm dark:from-primary/25 dark:to-primary/15 dark:text-primary-foreground'
                    : 'text-foreground hover:bg-primary-subtle/50 dark:hover:bg-muted'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/salon/profile"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                isActive
                  ? 'bg-gradient-to-l from-primary-subtle to-primary/20 text-primary dark:from-primary/25 dark:to-primary/15 dark:text-primary-foreground'
                  : 'text-foreground hover:bg-primary-subtle/50 dark:hover:bg-muted'
              )
            }
          >
            <Store className="h-4 w-4 shrink-0" />
            ملف الصالون
          </NavLink>
          <Button
            variant="ghost"
            className="mt-4 w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 border-primary/25" onClick={() => navigate('/home')}>
            <Smartphone className="h-4 w-4" />
            تطبيق العملاء
          </Button>
        </nav>
      </aside>

      <main className="md:me-56">
        <div className="mx-auto max-w-3xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-8 md:max-w-4xl md:pt-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-primary/15 bg-white/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_-4px_rgb(212_165_165/0.15)] backdrop-blur-md dark:border-border dark:bg-card md:hidden">
        {nav.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold',
                isActive ? 'text-primary' : 'text-foreground'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate px-0.5">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/salon/profile"
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold',
              isActive ? 'text-primary' : 'text-foreground'
            )
          }
        >
          <Store className="h-5 w-5 shrink-0" />
          <span className="truncate">الملف</span>
        </NavLink>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1 text-[9px] font-bold text-destructive"
        >
          <LogOut className="h-5 w-5" />
          خروج
        </button>
      </nav>
    </div>
  )
}
