import { useCallback, useRef, useState } from 'react'

const RADIUS = 60
const MAX_PX = 8

/** Desktop: translate up to MAX_PX toward cursor when within RADIUS px (batched with rAF). */
export function useMagneticOffset(enabled: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const rafRef = useRef(0)

  const flush = useCallback((x: number, y: number) => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setOffset({ x, y }))
  }, [])

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!enabled) return
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist > RADIUS || dist < 0.5) {
        flush(0, 0)
        return
      }
      const nx = dx / dist
      const ny = dy / dist
      const strength = 1 - dist / RADIUS
      flush(nx * MAX_PX * strength, ny * MAX_PX * strength)
    },
    [enabled, flush]
  )

  const onMouseLeave = useCallback(() => {
    flush(0, 0)
  }, [flush])

  return { offset, onMouseMove, onMouseLeave }
}
