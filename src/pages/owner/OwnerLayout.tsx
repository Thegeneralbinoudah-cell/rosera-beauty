import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutDashboard, Scissors, Clock, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/dashboard', label: 'الرئيسية', end: true, icon: LayoutDashboard },
  { to: '/dashboard/services', label: 'الخدمات', icon: Scissors },
  { to: '/dashboard/schedule', label: 'الجدول', icon: Clock },
  { to: '/dashboard/reports', label: 'التقارير', icon: BarChart3 },
]

export default function OwnerLayout() {
  const { isBusinessOwner, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8">...</div>
  if (!isBusinessOwner && !isAdmin) return <Navigate to="/profile" replace />

  return (
    <div className="min-h-dvh bg-rosera-light dark:bg-rosera-dark" dir="rtl">
      <header className="border-b bg-white px-4 py-3 dark:bg-card">
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">
          {links.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold',
                  isActive ? 'gradient-rosera text-white' : 'text-rosera-gray'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
