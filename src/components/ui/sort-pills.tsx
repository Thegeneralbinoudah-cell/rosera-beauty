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
}: SortPillsProps<T>) {
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
              'touch-manipulation rounded-full border-2 font-bold transition-all duration-200 ease-out',
              'active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2',
              dense ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
              active
                ? 'gradient-rosera border-transparent text-white shadow-elevated'
                : 'border-primary/25 bg-card/95 text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/80 hover:shadow-md'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
