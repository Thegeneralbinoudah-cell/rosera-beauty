import { cn } from '@/lib/utils'
import type { RozyVisionConfidence } from '@/lib/rozyVisionTypes'

type Props = {
  confidence: RozyVisionConfidence
  qualityOk: boolean
  className?: string
}

const confidenceAr: Record<RozyVisionConfidence, string> = {
  high: 'ثقة عالية',
  medium: 'ثقة متوسطة',
  low: 'ثقة منخفضة',
}

function safeConfidence(c: RozyVisionConfidence): RozyVisionConfidence {
  if (c === 'high' || c === 'medium' || c === 'low') return c
  return 'low'
}

export function ConfidenceBadge({ confidence, qualityOk, className }: Props) {
  const c = safeConfidence(confidence)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-3 py-1 text-caption font-semibold tracking-luxury shadow-sm transition-all duration-300',
          c === 'high' &&
            'border-emerald-400/35 bg-gradient-to-l from-emerald-500/15 to-teal-500/10 text-emerald-900 dark:text-emerald-100',
          c === 'medium' &&
            'border-amber-400/40 bg-gradient-to-l from-amber-400/20 to-gold/15 text-amber-950 dark:text-amber-100',
          c === 'low' &&
            'border-border bg-muted/80 text-muted-foreground',
        )}
      >
        {confidenceAr[c]}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-3 py-1 text-caption font-semibold tracking-luxury shadow-sm transition-all duration-300',
          qualityOk
            ? 'border-primary/35 bg-gradient-to-l from-primary/15 to-gold/10 text-primary'
            : 'border-rose-300/40 bg-rose-500/10 text-rose-800 dark:text-rose-200',
        )}
      >
        {qualityOk ? 'صورة مناسبة' : 'أعدي التقاط الصورة'}
      </span>
    </div>
  )
}
