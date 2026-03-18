import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutDashboard, Building2, Users, Calendar, Star, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/admin/businesses', label: 'المنشآت', icon: Building2 },
  { to: '/admin/users', label: 'المستخدمون', icon: Users },
  { to: '/admin/bookings', label: 'الحجوزات', icon: Calendar },
  { to: '/admin/reviews', label: 'التقييمات', icon: Star },
  { to: '/admin/analytics', label: 'التحليلات', icon: BarChart3 },
]

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8">...</div>
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-dvh bg-rosera-light dark:bg-rosera-dark" dir="rtl">
      <aside className="hidden w-56 shrink-0 border-e bg-white p-4 dark:bg-card md:block">
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
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
