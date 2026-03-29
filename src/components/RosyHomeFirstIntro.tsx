import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STORAGE_KEYS } from '@/lib/utils'
import { ROSY_FIRST_VISIT_WELCOME } from '@/lib/roseyChatCopy'
import { usePreferences } from '@/contexts/PreferencesContext'
import { cn } from '@/lib/utils'
import { captureProductEvent } from '@/lib/posthog'
import { colors } from '@/theme/colors'

const EN_INTRO =
  "Hey love—I'm Rosy! I can help you pick the best salon, aesthetics clinic, or beauty products from global brands."

/**
 * بطاقة ترحيب لمرة واحدة على الرئيسية — نفس مفتاح التخزين المستخدم في أول رسالة دردشة لتجنّب التكرار.
 */
export function RosyHomeFirstIntro({ className }: { className?: string }) {
  const { lang } = usePreferences()
  const [dismissed, setDismissed] = useState(() => {
      try {
        return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.roseraRosyFirstWelcomeShown) === '1'
      } catch {
        return false
      }
    })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.roseraRosyFirstWelcomeShown, '1')
    } catch {
      /* ignore */
    }
    captureProductEvent('rosy_home_intro_dismiss', {})
    setDismissed(true)
  }, [])

  if (dismissed) return null

  const text = lang === 'ar' ? ROSY_FIRST_VISIT_WELCOME : EN_INTRO

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-4 shadow-[0_16px_44px_-18px_rgba(212,165,165,0.42)] dark:border-primary/35 dark:bg-card',
        className
      )}
      style={{ backgroundImage: `linear-gradient(to bottom right, ${colors.surface}, ${colors.surface})` }}
    >
      <div
        className="pointer-events-none absolute -start-6 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-pink-300/25 to-amber-200/20 blur-2xl"
        aria-hidden
      />
      <div className="relative flex gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-accent to-accent shadow-[0_8px_24px_-6px_rgba(212,165,165,0.55)]"
          aria-hidden
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <p className="min-w-0 flex-1 text-sm font-bold leading-relaxed text-foreground">{text}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl text-foreground hover:bg-pink-100/60 dark:hover:bg-pink-950/40"
          aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative mt-3 flex justify-end border-t border-border/70 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl font-bold text-primary hover:bg-pink-50 dark:hover:bg-pink-950/30"
          onClick={dismiss}
        >
          {lang === 'ar' ? 'تم، واضح' : 'Got it'}
        </Button>
      </div>
    </motion.div>
  )
}
