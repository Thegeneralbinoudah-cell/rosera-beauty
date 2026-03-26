import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
  /** Decorative gradient frame */
  variant?: 'luxury' | 'soft'
  title?: ReactNode
  /** Icon or emoji slot */
  adornment?: ReactNode
}

export function ResultCard({ children, className, variant = 'luxury', title, adornment }: Props) {
  const frame =
    variant === 'luxury'
      ? 'bg-gradient-to-br from-primary/45 via-rose-200/50 to-gold/55 p-[1px] shadow-[0_12px_40px_-10px_rgba(244,114,182,0.38),0_6px_20px_-6px_rgba(251,191,36,0.22)]'
      : 'bg-gradient-to-br from-primary/20 to-gold/15 p-[1px] shadow-elevated'

  return (
    <div
      className={cn(
        'rounded-3xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:fill-mode-both',
        frame,
        className,
      )}
    >
      <div
        className={cn(
          'rounded-2xl bg-card/95 px-5 py-5 backdrop-blur-sm dark:bg-card/90',
          'border border-white/60 dark:border-white/5',
        )}
      >
        {(title || adornment) && (
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            {title && (
              <h2 className="text-title font-bold text-transparent bg-clip-text bg-gradient-to-l from-primary via-rose-500 to-gold">
                {title}
              </h2>
            )}
            {adornment}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
