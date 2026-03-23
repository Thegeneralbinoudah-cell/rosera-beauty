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
}

/**
 * Segmented sort control — real buttons, visible active state, press + hover motion.
 */
export function SortPills<T extends string>({ value, onChange, options, className, dense, nowrap }: SortPillsProps<T>) {
  return (
    <div
      className={cn('flex gap-2', nowrap ? 'flex-nowrap' : 'flex-wrap', className)}
      role="tablist"
      aria-label="Sort"
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
              'touch-manipulation rounded-2xl font-semibold transition-all duration-200 ease-out',
              'active:scale-[0.98]',
              dense ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
              active
                ? 'bg-gradient-to-br from-[#f472b6] via-[#f9a8c9] to-[#fbcfe8] text-[#1f2937] shadow-premium ring-2 ring-pink-300/50 dark:from-[#be185d] dark:via-[#db2777] dark:to-[#ec4899] dark:text-white dark:ring-pink-500/40'
                : 'bg-white text-[#374151] shadow-sm ring-1 ring-[#E5E7EB] hover:bg-[#FDF2F8] hover:ring-[#F9A8C9]/35 dark:bg-card dark:text-foreground dark:ring-border dark:hover:bg-muted/50'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
