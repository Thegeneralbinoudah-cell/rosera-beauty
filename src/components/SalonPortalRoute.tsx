import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

/** يسمح لمالكة الصالون (salon_owners / owner_id) أو فريق الإدارة بالوصول — بدون الاعتماد على role = owner فقط */
export default function SalonPortalRoute({ children }: { children: ReactNode }) {
  const { loading, user, isSalonPortal, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-8 dark:bg-background" dir="rtl">
        جاري التحميل…
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  if (!isSalonPortal && !isAdmin) return <Navigate to="/owner/login" replace />

  return <>{children}</>
}
