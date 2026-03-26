import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// IMPORTANT:
// Admin/staff access matches public.is_privileged_staff() in DB (see isAdmin in AuthContext).

type ProtectedRouteProps = {
  children: ReactNode
  /** When true, only privileged staff (isAdmin) may access */
  requirePrivilegedStaff?: boolean
}

export default function ProtectedRoute({ requirePrivilegedStaff, children }: ProtectedRouteProps) {
  const { loading, user, isAdmin } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center p-8">جاري التحقق…</div>
  }

  if (!user) return <Navigate to="/auth" replace />

  if (requirePrivilegedStaff && !isAdmin) return <Navigate to="/home" replace />

  return <>{children}</>
}
