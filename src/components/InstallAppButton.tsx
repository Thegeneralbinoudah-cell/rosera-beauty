import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IosInstallGuideDialog } from '@/components/pwa/IosInstallGuideDialog'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import {
  isStandaloneDisplayMode,
  shouldShowIOSInstallGuide,
} from '@/lib/pwaInstall'
import { captureProductEvent } from '@/lib/posthog'
import { tr } from '@/lib/i18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { cn } from '@/lib/utils'

type InstallAppButtonProps = {
  className?: string
  variant?: 'default' | 'premium'
  labelKey?: 'pwa.installApp' | 'pwa.installCta' | 'pwa.installCtaStrong' | 'pwa.installAppStrong'
}

/**
 * - iOS Safari: زر يفتح دليل التثبيت فقط (لا beforeinstallprompt).
 * - Chrome/Edge/Android: زر التثبيت عند توفر beforeinstallprompt.
 */
export function InstallAppButton({
  className,
  variant = 'default',
  labelKey = 'pwa.installApp',
}: InstallAppButtonProps) {
  const { lang } = usePreferences()
  const navigate = useNavigate()
  const { canPrompt, promptInstall } = useInstallPrompt()
  const [iosGuideOpen, setIosGuideOpen] = useState(false)

  if (isStandaloneDisplayMode()) return null

  const isPremium = variant === 'premium'
  const premiumClass =
    'rounded-2xl border-2 border-amber-300/90 bg-gradient-to-r from-primary/25 via-secondary to-accent/35 text-rose-950 shadow-[0_10px_36px_-12px_rgba(212,165,165,0.45),0_0_0_1px_rgba(197,160,89,0.35)_inset] hover:from-primary/35 hover:via-secondary hover:to-accent/45 dark:border-amber-600/50 dark:from-primary/25 dark:via-secondary/30 dark:to-accent/25 dark:text-rose-50'

  if (shouldShowIOSInstallGuide()) {
    return (
      <>
        <Button
          type="button"
          onClick={() => {
            captureProductEvent('install_clicked', { source: 'ios_safari_guide' })
            setIosGuideOpen(true)
          }}
          className={cn(
            'gap-2 font-bold shadow-md transition-all active:scale-[0.98]',
            isPremium ? premiumClass : 'font-semibold shadow-sm',
            className
          )}
          variant={isPremium ? 'secondary' : 'default'}
        >
          <Download className="h-5 w-5 shrink-0" aria-hidden />
          {tr(lang, labelKey)}
        </Button>
        <IosInstallGuideDialog open={iosGuideOpen} onOpenChange={setIosGuideOpen} />
      </>
    )
  }

  if (canPrompt) {
    return (
      <Button
        type="button"
        onClick={() => {
          captureProductEvent('install_clicked', { source: 'browser_prompt' })
          void promptInstall()
        }}
        className={cn(
          'gap-2 font-bold shadow-md transition-all active:scale-[0.98]',
          isPremium ? premiumClass : 'font-semibold shadow-sm',
          className
        )}
        variant={isPremium ? 'secondary' : 'default'}
      >
        <Download className="h-5 w-5 shrink-0" aria-hidden />
        {tr(lang, labelKey)}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      onClick={() => {
        captureProductEvent('install_clicked', { source: 'install_fallback_navigate' })
        navigate('/install')
      }}
      className={cn(
        'gap-2 font-bold shadow-md transition-all active:scale-[0.98]',
        isPremium ? premiumClass : 'font-semibold shadow-sm',
        className
      )}
      variant={isPremium ? 'secondary' : 'default'}
    >
      <Download className="h-5 w-5 shrink-0" aria-hidden />
      {tr(lang, labelKey)}
    </Button>
  )
}
