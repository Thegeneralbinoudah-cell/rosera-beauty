import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type ProtectedRouteProps = {
  allowedRoles: string[]
  children: ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { loading, user, profile } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center p-8">جاري التحقق…</div>
  }

  if (!user) return <Navigate to="/auth" replace />

  const role = (profile?.role ?? 'user').toLowerCase()
  const allowed = allowedRoles.map((r) => r.toLowerCase()).includes(role)

  if (!allowed) return <Navigate to="/home" replace />

  return <>{children}</>
}
