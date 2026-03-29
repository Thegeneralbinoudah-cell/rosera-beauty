import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { StickyBookingCta } from './StickyBookingCta'
import { FloatingBackButton } from '@/components/FloatingBackButton'
import { IssueFeedbackPrompt } from '@/components/IssueFeedbackPrompt'
import { InstallAutoSuggest } from '@/components/InstallAutoSuggest'
import { PwaFirstVisitDialog } from '@/components/PwaFirstVisitDialog'

/** مساحة سفلية للمحتوى — BottomNav + FAB روزي (~76px) + safe area */
const LAYOUT_BOTTOM_PAD = 'calc(6rem + 84px + env(safe-area-inset-bottom, 0px) + 12px)'

export function CustomerLayout() {
  const location = useLocation()
  return (
    <div
      className="min-h-dvh pt-[env(safe-area-inset-top,0px)]"
      style={{ paddingBottom: LAYOUT_BOTTOM_PAD }}
    >
      <div key={location.pathname} className="animate-page-enter motion-reduce:animate-none">
        <Outlet />
      </div>
      <StickyBookingCta />
      <IssueFeedbackPrompt />
      <FloatingBackButton />
      <BottomNav />
      <PwaFirstVisitDialog />
      <InstallAutoSuggest />
    </div>
  )
}
