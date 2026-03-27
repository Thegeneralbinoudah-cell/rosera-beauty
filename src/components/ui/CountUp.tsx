import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Animates from 0 to `value` over 1.5s ease-out when scrolled into view (rAF). */
export function CountUp({
  value,
  className,
  format,
  decimals = 0,
}: {
  value: number
  className?: string
  /** Optional formatter for final display (e.g. currency). */
  format?: (n: number) => string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.35 })
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!isInView || started.current) return
    started.current = true
    const duration = 1500
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = easeOutCubic(t)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isInView, value])

  const text =
    format?.(display) ??
    (decimals > 0
      ? display.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(display).toLocaleString())

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  )
}
