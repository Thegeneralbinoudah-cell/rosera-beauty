import { type ReactNode, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Scroll-triggered fade + slight rise — transform/opacity only. */
export function Reveal({
  children,
  className,
  amount = 0.15,
}: {
  children: ReactNode
  className?: string
  /** Intersection ratio threshold (0–1). */
  amount?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: amount as number })
  const reduce = useReducedMotion()

  const visible = reduce || isInView

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
