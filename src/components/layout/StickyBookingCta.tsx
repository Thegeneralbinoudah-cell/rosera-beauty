import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

/** فوق شريط التنقل — يُحاذى ارتفاع الـ BottomNav (~4.5rem) + المنطقة الآمنة */
const CTA_BOTTOM = 'calc(4.5rem + env(safe-area-inset-bottom, 0px))'

export function StickyBookingCta() {
  const { pathname } = useLocation()
  const { t } = useI18n()

  if (
    pathname.startsWith('/map') ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/for-salons') ||
    pathname.startsWith('/rosy-vision')
  )
    return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-floating',
        'px-3 sm:px-4'
      )}
      style={{ bottom: CTA_BOTTOM }}
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-primary/25',
          'bg-white/85 py-2 pe-[calc(0.75rem+env(safe-area-inset-right,0px))] ps-3 shadow-[0_-8px_32px_-8px_rgba(249,168,201,0.18)] backdrop-blur-md',
          'dark:border-border dark:bg-rosera-dark/85',
          /* Physical left — FloatingBackButton uses `left`; avoids overlap under dir=rtl */
          'pl-[calc(3.75rem+env(safe-area-inset-left,0px))]'
        )}
      >
        <p className="min-w-0 flex-1 text-start font-cairo text-xs font-semibold leading-snug tracking-tight text-foreground sm:text-[13px]">
          {t('cta.bookBanner')}
        </p>
        <Link
          to="/map"
          className={cn(
            'gradient-rosera shrink-0 rounded-2xl px-4 py-2 text-xs font-bold text-white',
            'shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2'
          )}
        >
          {t('cta.startNow')}
        </Link>
      </div>
    </div>
  )
}
