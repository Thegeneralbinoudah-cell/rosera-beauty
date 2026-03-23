import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { StickyBookingCta } from './StickyBookingCta'
import { FloatingBackButton } from '@/components/FloatingBackButton'
import { RosyFloatingButton } from '@/components/RosyFloatingButton'

/** مساحة سفلية للمحتوى — يُحاذى مع ارتفاع التبويب والمنطقة الآمنة */
const LAYOUT_BOTTOM_PAD = 'calc(6rem + env(safe-area-inset-bottom, 0px))'

export function CustomerLayout() {
  const location = useLocation()
  return (
    <div
      className="min-h-dvh pt-[env(safe-area-inset-top,0px)]"
      style={{ paddingBottom: LAYOUT_BOTTOM_PAD }}
    >
      <div key={location.pathname} className="animate-premium-in">
        <Outlet />
      </div>
      <StickyBookingCta />
      <RosyFloatingButton />
      <FloatingBackButton />
      <BottomNav />
    </div>
  )
}
