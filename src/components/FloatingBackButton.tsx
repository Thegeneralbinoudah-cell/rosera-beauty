import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

const FAB_TOP = 'calc(12px + env(safe-area-inset-top, 0px))'
const FAB_START = 'max(16px, env(safe-area-inset-inline-start, 0px))'

/** زر عائم للرجوع — أعلى يسار الشاشة (لا يتداخل مع FAB روزي السفلي) */
export function FloatingBackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useI18n()

  /** الصفحة فيها زر رجوع مضمّن — نتجنّب زرّين */
  if (
    pathname === '/rosy-vision' ||
    pathname === '/skin-analysis' ||
    pathname.startsWith('/salon/')
  )
    return null

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="fixed z-floating flex h-14 w-14 min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-accent to-primary/90 text-rosera-strong shadow-floating ring-2 ring-card transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95 dark:from-primary/35 dark:via-primary/50 dark:to-primary dark:text-primary-foreground dark:ring-border"
      style={{
        top: FAB_TOP,
        insetInlineStart: FAB_START,
      }}
      aria-label={t('common.back')}
    >
      <ArrowLeft className="h-7 w-7 rtl:scale-x-[-1]" strokeWidth={2} aria-hidden />
    </button>
  )
}
