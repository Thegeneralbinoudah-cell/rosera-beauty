import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function CustomerLayout() {
  return (
    <div className="min-h-dvh pb-24">
      <Outlet />
      <BottomNav />
    </div>
  )
}
