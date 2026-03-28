import { type ReactNode, useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Scroll-triggered fade + slight rise — transform/opacity only. */
export function Reveal({
  children,
  className,
  amount = 0.05,
}: {
  children: ReactNode
  className?: string
  /** Intersection ratio threshold (0–1). */
  amount?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, {
    once: true,
    amount: amount as number,
    margin: '120px 0px 240px 0px',
  })
  const reduce = useReducedMotion()
  const [timedReveal, setTimedReveal] = useState(false)

  useEffect(() => {
    if (reduce || isInView) return
    const t = window.setTimeout(() => setTimedReveal(true), 1800)
    return () => window.clearTimeout(t)
  }, [reduce, isInView])

  const visible = reduce || isInView || timedReveal

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
