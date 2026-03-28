import { useRef } from 'react'
import { Star } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Five stars — fill in sequence with gold + subtle shimmer when scrolled into view (transform/opacity only). */
export function LuxuryStarRating({
  rating,
  className,
  starClassName,
}: {
  rating: number
  className?: string
  starClassName?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const r = Math.min(5, Math.max(0, Number(rating) || 0))
  const fullCount = Math.min(5, Math.floor(r + 1e-6))

  return (
    <span ref={ref} className={cn('inline-flex items-center gap-0.5', className)} dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= fullCount
        return (
          <motion.span
            key={i}
            className={cn('relative inline-flex', starClassName)}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.88 }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 22,
              delay: (i - 1) * 0.08,
            }}
          >
            {filled && (
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
                aria-hidden
              >
                <span
                  className={cn(
                    'luxury-star-shimmer absolute inset-y-0 start-0 w-[140%] rounded-sm',
                    isInView && 'luxury-star-shimmer--run'
                  )}
                  style={
                    isInView ? { animationDelay: `${(i - 1) * 80}ms` } : undefined
                  }
                />
              </span>
            )}
            <Star
              className={cn(
                'relative z-[1] h-4 w-4 shrink-0',
                filled ? 'fill-accent text-primary' : 'fill-none text-foreground/90'
              )}
              strokeWidth={1.25}
              aria-hidden
            />
          </motion.span>
        )
      })}
    </span>
  )
}
