import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

/** روزي — floating above bottom nav on main customer routes */
export function RosyFloatingButton() {
  const { pathname } = useLocation()
  if (pathname === '/chat') return null

  return (
    <Link
      to="/chat"
      className="fixed z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] via-[#f8bbd9] to-[#e91e8c] text-[#9B2257] shadow-[0_8px_32px_rgba(233,30,140,0.45)] ring-2 ring-white/90 transition hover:scale-105 active:scale-95 dark:from-[#4a148c] dark:via-[#ad1457] dark:to-[#e91e8c] dark:text-white dark:ring-white/25"
      style={{
        bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
        insetInlineEnd: 'max(1rem, env(safe-area-inset-right))',
      }}
      aria-label="روزي — المساعدة الذكية"
    >
      <Sparkles className="h-7 w-7" strokeWidth={2} aria-hidden />
    </Link>
  )
}
