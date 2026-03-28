import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { isAppleMobileDevice, isStandaloneDisplayMode } from '@/lib/pwaInstall'
import { captureProductEvent } from '@/lib/posthog'
import { STORAGE_KEYS, cn } from '@/lib/utils'
import { tr } from '@/lib/i18n'
import { usePreferences } from '@/contexts/PreferencesContext'

const SESSION_KEY = 'rosera_pwa_nudge_shown_session'
const NUDGE_DELAY_MS = 12_000

/**
 * بعد ~12 ثانية يعرض اقتراح تثبيت (مرة لكل جلسة ما لم يُرفض مسبقاً).
 */
export function InstallAutoSuggest() {
  const { lang } = usePreferences()
  const navigate = useNavigate()
  const { canPrompt, promptInstall } = useInstallPrompt()
  const canPromptRef = useRef(canPrompt)
  canPromptRef.current = canPrompt

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandaloneDisplayMode()) return
    /** لا تتداخل مع نافذة أول زيارة قبل إكمالها */
    if (!localStorage.getItem(STORAGE_KEYS.pwaFirstVisitDone)) return
    if (localStorage.getItem(STORAGE_KEYS.pwaNudgeDismissed)) return
    if (sessionStorage.getItem(SESSION_KEY)) return

    const t = window.setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1')
      captureProductEvent('install_prompt_shown', { source: 'session_nudge_toast' })

      toast.custom(
        (id) => (
          <div
            className={cn(
              'pointer-events-auto w-[min(100vw-2rem,22rem)] rounded-3xl border border-pink-200/65 bg-gradient-to-br from-white via-rose-50/95 to-amber-50/85 p-4 shadow-floating ring-1 ring-gold/15 dark:border-rose-900/40 dark:from-card dark:via-rose-950/40 dark:to-amber-950/22'
            )}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-50">
              {tr(lang, 'pwa.installNudgeTitle')}
            </p>
            <p className="mt-1 text-xs text-foreground">{tr(lang, 'pwa.installNudgeBody')}</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-foreground"
                onClick={() => {
                  localStorage.setItem(STORAGE_KEYS.pwaNudgeDismissed, '1')
                  toast.dismiss(id)
                }}
              >
                {tr(lang, 'pwa.installNudgeDismiss')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-gradient-to-r from-pink-500 to-amber-500 text-white hover:from-pink-600 hover:to-amber-600"
                onClick={() => {
                  /** على iOS لا يوجد beforeinstallprompt — صفحة التثبيت أو الدليل */
                  if (isAppleMobileDevice()) {
                    captureProductEvent('install_clicked', { source: 'nudge_toast_ios' })
                    navigate('/install')
                  } else if (canPromptRef.current) {
                    captureProductEvent('install_clicked', { source: 'nudge_toast_prompt' })
                    void promptInstall()
                  } else {
                    captureProductEvent('install_clicked', { source: 'nudge_toast_fallback' })
                    navigate('/install')
                  }
                  toast.dismiss(id)
                }}
              >
                {tr(lang, 'pwa.installNudgeConfirm')}
              </Button>
            </div>
          </div>
        ),
        { duration: 25_000, position: 'top-center' }
      )
    }, NUDGE_DELAY_MS)

    return () => window.clearTimeout(t)
  }, [lang, navigate, promptInstall])

  return null
}
