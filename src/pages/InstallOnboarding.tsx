import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { InstallAppButton } from '@/components/InstallAppButton'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { isStandaloneDisplayMode, shouldShowIOSInstallGuide } from '@/lib/pwaInstall'
import { tr } from '@/lib/i18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { cn } from '@/lib/utils'
import { colors } from '@/theme/colors'

export default function InstallOnboarding() {
  const { lang } = usePreferences()
  const { canPrompt } = useInstallPrompt()
  const standalone = isStandaloneDisplayMode()
  const showInstallCtaBlock =
    !standalone && (shouldShowIOSInstallGuide() || canPrompt)
  const benefits = ['pwa.benefit1', 'pwa.benefit2', 'pwa.benefit3'] as const

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-gradient-to-b via-white pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] dark:from-rose-950/30 dark:via-background dark:to-amber-950/10"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${colors.surface}, white, ${colors.secondary})`,
      }}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232,180,184,0.5), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(212,175,55,0.12), transparent)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-lg px-5">
        <Link
          to="/home"
          className="inline-flex items-center gap-2 text-sm font-medium text-rose-800/80 transition hover:text-rose-950 dark:text-rose-200/90"
        >
          {lang === 'ar' ? (
            <>
              <span>{tr(lang, 'common.back')}</span>
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
              <span>{tr(lang, 'common.back')}</span>
            </>
          )}
        </Link>

        <header className="mt-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-200/80 to-amber-200/70 shadow-lg shadow-rose-900/10 ring-2 ring-white/80 dark:from-pink-900/40 dark:to-amber-900/30 dark:ring-rose-900/30">
            <Sparkles className="h-8 w-8 text-rose-800 dark:text-rose-100" aria-hidden />
          </div>
          <h1 className="bg-gradient-to-r from-rose-700 via-pink-600 to-amber-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-rose-300 dark:via-pink-300 dark:to-amber-200">
            {tr(lang, 'pwa.pageTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{tr(lang, 'pwa.pageSubtitle')}</p>
        </header>

        <section className="mt-10" aria-labelledby="preview-heading">
          <p id="preview-heading" className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-rose-400/90">
            {tr(lang, 'pwa.previewCaption')}
          </p>
          <div className="relative mx-auto aspect-[9/16] w-[min(100%,260px)] overflow-hidden rounded-[2rem] border border-pink-100/80 bg-gradient-to-b from-pink-50/90 via-white to-amber-50/50 shadow-[0_24px_60px_-20px_rgba(180,80,120,0.35)] dark:border-rose-900/50 dark:from-rose-950/50 dark:via-card dark:to-amber-950/20">
            <div className="absolute inset-x-0 top-0 flex h-10 items-center justify-center rounded-b-2xl bg-gradient-to-r from-pink-100/90 to-amber-100/70 text-xs font-semibold text-rose-900/80 dark:from-pink-950/60 dark:to-amber-950/40 dark:text-rose-100">
              Rosy
            </div>
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 pt-14 pb-8">
              <img
                src="/rosera-logo.svg"
                alt=""
                className="h-20 w-20 opacity-90 drop-shadow-md"
              />
              <div className="h-2 w-24 rounded-full bg-gradient-to-r from-pink-300/60 to-amber-300/50" />
              <div className="w-full space-y-2 rounded-2xl border border-pink-100/60 bg-white/80 p-4 shadow-inner dark:border-rose-900/40 dark:bg-card/80">
                <div className="h-2 w-3/4 rounded bg-rose-100/80 dark:bg-rose-900/40" />
                <div className="h-2 w-1/2 rounded bg-amber-100/70 dark:bg-amber-900/30" />
                <div className="h-8 w-full rounded-xl bg-gradient-to-r from-pink-200/50 to-amber-200/40 dark:from-pink-900/30 dark:to-amber-900/20" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-4" aria-labelledby="benefits-heading">
          <h2 id="benefits-heading" className="sr-only">
            Benefits
          </h2>
          <ul className="space-y-3">
            {benefits.map((key) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-2xl border border-pink-100/70 bg-white/70 px-4 py-3 shadow-sm dark:border-rose-900/40 dark:bg-card/60"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
                <span className="text-sm font-medium text-foreground">{tr(lang, key)}</span>
              </li>
            ))}
          </ul>
        </section>

        {showInstallCtaBlock && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <InstallAppButton
              variant="premium"
              labelKey="pwa.installCtaStrong"
              className="min-h-[3.25rem] min-w-[240px] px-10 text-base"
            />
            <p className="max-w-sm text-center text-xs text-muted-foreground">{tr(lang, 'pwa.installHint')}</p>
          </div>
        )}

        <section className="mt-12 rounded-2xl border border-amber-200/40 bg-white/60 p-5 dark:border-amber-900/30 dark:bg-card/50">
          <h2 className="text-sm font-bold text-rose-900 dark:text-rose-100">{tr(lang, 'pwa.instructionsTitle')}</h2>
          <ul className={cn('mt-3 space-y-2 text-sm text-muted-foreground', lang === 'ar' ? 'list-disc pr-5' : 'list-disc pl-5')}>
            <li>{tr(lang, 'pwa.instructionsAndroid')}</li>
            <li>{tr(lang, 'pwa.instructionsIos')}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
