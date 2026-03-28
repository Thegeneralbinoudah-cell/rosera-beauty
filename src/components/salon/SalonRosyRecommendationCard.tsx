import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  title?: string
  serviceName: string
  explanation: string
  onBook: () => void
  className?: string
}

/**
 * بطاقة اقتراح روزي في صفحة الصالون — عرض فقط، بدون جلب بيانات.
 */
export function SalonRosyRecommendationCard({
  title = 'روزي تقترح لك',
  serviceName,
  explanation,
  onBook,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-card via-primary-subtle/60 to-amber-50/45 p-5 shadow-floating ring-1 ring-gold/15 dark:from-card dark:via-primary/15 dark:to-amber-950/25 dark:border-amber-500/25',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -start-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-primary/25 to-amber-300/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 end-0 h-32 w-32 rounded-full bg-amber-300/15 blur-2xl dark:bg-amber-600/10"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-100/90 to-card shadow-inner ring-1 ring-amber-400/25 dark:from-amber-900/40">
            <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5 text-start">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary dark:text-primary">
              {title}
            </p>
            <p className="text-lg font-extrabold leading-snug text-foreground sm:text-xl">{serviceName}</p>
            <p className="text-sm leading-relaxed text-foreground">{explanation}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onBook}
          className="w-full shrink-0 rounded-3xl border border-gold/25 gradient-primary px-5 py-5 text-sm font-bold text-white shadow-floating ring-1 ring-gold/20 sm:w-auto sm:self-center"
        >
          احجزي هذا الخيار
        </Button>
      </div>
    </div>
  )
}
