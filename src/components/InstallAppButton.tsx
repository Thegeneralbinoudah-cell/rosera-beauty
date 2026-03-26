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
    'rounded-2xl border-2 border-amber-300/90 bg-gradient-to-r from-[#fce7f3] via-[#fff7ed] to-[#fef3c7] text-rose-950 shadow-[0_10px_36px_-12px_rgba(219,39,119,0.45),0_0_0_1px_rgba(251,191,36,0.35)_inset] hover:from-pink-200/95 hover:via-rose-50 hover:to-amber-100 dark:border-amber-600/50 dark:from-pink-950/55 dark:via-rose-950/35 dark:to-amber-950/30 dark:text-rose-50'

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
