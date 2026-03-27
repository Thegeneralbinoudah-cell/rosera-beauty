import { cn } from '@/lib/utils'

export type SortPillOption<T extends string = string> = { value: T; label: string }

type SortPillsProps<T extends string> = {
  value: T
  onChange: (v: T) => void
  options: SortPillOption<T>[]
  className?: string
  /** For RTL pages, flex direction is handled by parent `dir` */
  dense?: boolean
  /** Single row + horizontal scroll on narrow screens */
  nowrap?: boolean
  /** Accessible name for the tablist */
  ariaLabel?: string
  /**
   * `mapLuxury` — fixed charcoal + gold border + pearl text (always readable on map overlay).
   * `default` — theme-aware segmented control.
   */
  variant?: 'default' | 'mapLuxury'
}

/**
 * Segmented sort control — real buttons, visible active state, press + hover motion.
 */
export function SortPills<T extends string>({
  value,
  onChange,
  options,
  className,
  dense,
  nowrap,
  ariaLabel = 'Sort',
  variant = 'default',
}: SortPillsProps<T>) {
  const isMap = variant === 'mapLuxury'

  return (
    <div
      className={cn('flex gap-2', nowrap ? 'flex-nowrap' : 'flex-wrap', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'touch-manipulation transition-all duration-200 ease-out',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              isMap
                ? cn(
                    'min-h-[36px] min-w-0 shrink rounded-full border px-3 py-2 text-[13px] font-semibold leading-snug',
                    'max-w-[min(100%,22rem)] text-balance',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-md'
                      : 'border-border/80 bg-card/95 text-foreground shadow-sm backdrop-blur-sm hover:border-primary/40 dark:bg-card/90'
                  )
                : cn(
                    'rounded-full border-2 font-bold',
                    dense ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
                    active
                      ? 'gradient-rosera border-transparent text-white shadow-elevated'
                      : 'border-primary/25 bg-card/95 text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/80 hover:shadow-md'
                  )
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
