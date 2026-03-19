import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function CustomerLayout() {
  return (
    <div className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-[env(safe-area-inset-top,0px)]">
      <Outlet />
      <BottomNav />
    </div>
  )
}
