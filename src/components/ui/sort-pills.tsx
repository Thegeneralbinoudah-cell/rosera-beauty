import { cn } from '@/lib/utils'
import { attachRipple } from '@/lib/ripple'

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
   * `secondary` — softer visual weight for secondary controls.
   * `default` — theme-aware segmented control.
   */
  variant?: 'default' | 'secondary' | 'mapLuxury'
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
  const isSecondary = variant === 'secondary'

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
            onClick={(e) => {
              attachRipple(e)
              onChange(opt.value)
            }}
            className={cn(
              'ripple touch-manipulation transition-all duration-200 ease-out',
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
                    'min-h-12 shrink-0 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm',
                    dense ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-sm',
                    active
                      ? 'gradient-rosera border-transparent text-primary-foreground shadow-md'
                      : isSecondary
                        ? 'border-primary/15 bg-muted/45 text-foreground/90 shadow-none hover:border-primary/25 hover:bg-muted/65 hover:shadow-sm'
                        : 'hover:border-primary/30 hover:bg-primary/10 hover:shadow-md'
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
