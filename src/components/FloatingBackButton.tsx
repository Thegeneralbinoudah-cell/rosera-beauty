import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/** Above bottom nav (~6rem) + sticky booking CTA (~2.75rem) + safe area */
const FAB_BOTTOM = 'calc(8.85rem + env(safe-area-inset-bottom, 0px) + 4px)'
const FAB_LEFT = 'max(0.75rem, env(safe-area-inset-left, 0px))'

/** زر عائم للرجوع — يسار الشاشة ثابتاً، فوق شريط التنقل */
export function FloatingBackButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="fixed z-[650] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] via-[#f8bbd9] to-[#e91e8c] text-[#9B2257] shadow-[0_8px_32px_rgba(233,30,140,0.45)] ring-2 ring-white/90 transition hover:scale-105 active:scale-95 dark:from-[#4a148c] dark:via-[#ad1457] dark:to-[#e91e8c] dark:text-white dark:ring-white/25"
      style={{
        bottom: FAB_BOTTOM,
        left: FAB_LEFT,
      }}
      aria-label="رجوع"
    >
      <ArrowLeft className="h-7 w-7 rtl:scale-x-[-1]" strokeWidth={2} aria-hidden />
    </button>
  )
}
