import { Link } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

/** فوق شريط الـ CTA والتبويب — لا يعتمد على المسار؛ يظهر في كل صفحات العميل */
const ROSY_BOTTOM = 'calc(6.5rem + env(safe-area-inset-bottom, 0px))'

export function RosyFloatingButton() {
  const { t } = useI18n()

  return (
    <Link
      to="/chat"
      className={cn(
        'fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full',
        'bg-gradient-to-br from-[#fce4ec] via-[#f472b6] to-[#be185d]',
        'text-white shadow-[0_8px_28px_rgba(190,24,93,0.35)] ring-2 ring-white/90',
        'transition hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
        'dark:from-[#4a148c] dark:via-[#be185d] dark:to-[#9d174d] dark:ring-white/25'
      )}
      style={{
        bottom: ROSY_BOTTOM,
        insetInlineEnd: 'max(1rem, env(safe-area-inset-inline-end, 0px))',
      }}
      aria-label={t('profile.ai')}
    >
      <Bot className="h-7 w-7" strokeWidth={2} aria-hidden />
    </Link>
  )
}
