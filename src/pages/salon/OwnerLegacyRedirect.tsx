import { Navigate, useLocation } from 'react-router-dom'

const MAP: Record<string, string> = {
  '/': '/salon/dashboard',
  '/bookings': '/salon/bookings',
  '/services': '/salon/services',
  '/schedule': '/salon/dashboard',
  '/reports': '/salon/analytics',
  '/subscription': '/salon/subscription',
  '/ads': '/salon/ads',
}

/** يحوّل المسارات القديمة /owner/* إلى لوحة /salon/* */
export default function OwnerLegacyRedirect() {
  const { pathname } = useLocation()
  const sub = pathname === '/owner' ? '/' : pathname.slice('/owner'.length) || '/'
  const target = MAP[sub] ?? '/salon/dashboard'
  return <Navigate to={target} replace />
}
