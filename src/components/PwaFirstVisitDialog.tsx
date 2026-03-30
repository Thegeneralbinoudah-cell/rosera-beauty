import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import {
  isAppleMobileDevice,
  isPwaInstallPromoSupported,
  isStandaloneDisplayMode,
} from '@/lib/pwaInstall'
import { captureProductEvent } from '@/lib/posthog'
import { STORAGE_KEYS } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { cn } from '@/lib/utils'
import { colors } from '@/theme/colors'

/** تأخير قصير — يعطي وقتاً لقراءة الرئيسية ورسالة روزي دون تكديس فوري */
const FIRST_VISIT_DELAY_MS = 4_500
const SESSION_MODAL_OPEN = 'rosera_pwa_first_visit_modal_open'

const shellClass =
  'gap-6 rounded-3xl border border-pink-200/55 bg-gradient-to-b via-white to-amber-50/90 p-8 shadow-floating dark:border-pink-900/40 dark:from-rose-950/45 dark:via-card dark:to-amber-950/22'

const shellStyle = {
  backgroundImage: `linear-gradient(to bottom, ${colors.surface}, white, color-mix(in srgb, ${colors.accent} 22%, transparent))`,
} as const

function usePreferInstallSheet() {
  const [preferSheet, setPreferSheet] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const apply = () => setPreferSheet(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return preferSheet
}

/**
 * نافذة / شيت أول زيارة — مرة واحدة، عند صلاحية التثبيت فقط.
 */
export function PwaFirstVisitDialog() {
  const { lang } = usePreferences()
  const navigate = useNavigate()
  const preferSheet = usePreferInstallSheet()
  const { canPrompt, promptInstall } = useInstallPrompt()
  const [open, setOpen] = useState(false)
  const installChosenRef = useRef(false)

  const markDone = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.pwaFirstVisitDone, '1')
      sessionStorage.removeItem(SESSION_MODAL_OPEN)
    } catch {
      /* ignore */
    }
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) {
        markDone()
        if (!installChosenRef.current) {
          captureProductEvent('pwa_first_visit_dismiss', {})
        }
        installChosenRef.current = false
      }
    },
    [markDone]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isPwaInstallPromoSupported()) return
    if (isStandaloneDisplayMode()) return
    if (localStorage.getItem(STORAGE_KEYS.pwaFirstVisitDone)) return

    const t = window.setTimeout(() => {
      if (isStandaloneDisplayMode()) return
      try {
        sessionStorage.setItem(SESSION_MODAL_OPEN, '1')
      } catch {
        /* ignore */
      }
      setOpen(true)
      captureProductEvent('install_prompt_shown', { source: 'first_visit_modal' })
    }, FIRST_VISIT_DELAY_MS)

    return () => window.clearTimeout(t)
  }, [])

  const onInstall = () => {
    installChosenRef.current = true
    captureProductEvent('install_clicked', { source: 'first_visit_popup' })
    markDone()
    setOpen(false)
    if (isAppleMobileDevice() || !canPrompt) {
      navigate('/install')
      return
    }
    void promptInstall()
  }

  const onLater = () => {
    setOpen(false)
  }

  const isRtl = lang === 'ar'
  const glow = (
    <div
      className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(251,191,36,0.2),transparent_55%)]"
      aria-hidden
    />
  )

  const iconBlock = (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-300/90 to-amber-200/85 shadow-elevated ring-2 ring-white/40">
      <Sparkles className="h-7 w-7 text-white drop-shadow" aria-hidden />
    </div>
  )

  const actions = (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button
        type="button"
        onClick={onInstall}
        className={cn(
          'order-1 min-h-[3.25rem] flex-1 rounded-2xl border-0 text-base font-bold text-white shadow-[0_0_28px_rgba(212,165,165,0.5),0_8px_24px_rgba(197,160,89,0.25)]',
          'bg-gradient-to-r from-primary via-accent to-secondary',
          'transition hover:brightness-105 active:scale-[0.98]',
          'dark:from-primary dark:via-accent dark:to-accent'
        )}
      >
        {tr(lang, 'pwa.installCta')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onLater}
        className="order-2 min-h-[3rem] flex-1 rounded-2xl text-base font-semibold text-foreground hover:bg-pink-50/80 dark:hover:bg-pink-950/30"
      >
        {tr(lang, 'pwa.installNudgeDismiss')}
      </Button>
    </div>
  )

  if (!preferSheet) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          dir={isRtl ? 'rtl' : 'ltr'}
          className={cn('max-w-[min(calc(100vw-2rem),24rem)]', shellClass, '[&>button.absolute]:hidden')}
          style={shellStyle}
        >
          {glow}
        <DialogHeader className="space-y-4 text-center sm:text-center">
          {iconBlock}
          <DialogTitle className="text-balance text-xl font-extrabold leading-snug text-rose-950 dark:text-rose-50">
            {tr(lang, 'pwa.firstVisitTitle')}
          </DialogTitle>
          <p className="text-pretty text-sm font-medium text-foreground">{tr(lang, 'pwa.firstVisitSub')}</p>
        </DialogHeader>
          {actions}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn('rounded-t-3xl', shellClass, 'pb-[max(1.5rem,env(safe-area-inset-bottom))]')}
        style={shellStyle}
      >
        {glow}
        <SheetHeader className="space-y-4 text-center">
          {iconBlock}
          <SheetTitle className="text-balance text-xl font-extrabold leading-snug text-rose-950 dark:text-rose-50">
            {tr(lang, 'pwa.firstVisitTitle')}
          </SheetTitle>
          <p className="text-pretty text-sm font-medium text-foreground">{tr(lang, 'pwa.firstVisitSub')}</p>
        </SheetHeader>
        {actions}
      </SheetContent>
    </Sheet>
  )
}
