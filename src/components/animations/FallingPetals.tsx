import { useMemo } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const PETAL_PATH =
  'M12 2 C8 8 4 14 4 22 C4 28 8 32 12 34 C16 32 20 28 20 22 C20 14 16 8 12 2 Z'

/** Twelve rose petals — slow fall, drift, infinite loop (pointer-events none). */
export function FallingPetals() {
  const prefersReducedMotion = usePrefersReducedMotion()

  const petals = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const left = ((i * 37 + 11) % 92) + 4
        const delay = ((i * 0.7) % 4) + i * 0.15
        const duration = 6 + (i % 5) * 0.85
        const drift = -35 + (i % 9) * 9
        const opacity = 0.3 + (i % 4) * 0.1
        const size = 14 + (i % 4) * 3
        const topStatic = ((i * 61 + 23) % 78) + 6
        return { left, delay, duration, drift, opacity, size, topStatic, id: i }
      }),
    []
  )

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {petals.map((p) => (
        <svg
          key={p.id}
          className={
            prefersReducedMotion ? 'absolute text-rosera-rose' : 'petal-fall absolute text-rosera-rose'
          }
          style={
            prefersReducedMotion
              ? {
                  left: `${p.left}%`,
                  top: `${p.topStatic}%`,
                  width: p.size,
                  height: p.size * 1.35,
                  opacity: p.opacity,
                }
              : {
                  left: `${p.left}%`,
                  top: 0,
                  width: p.size,
                  height: p.size * 1.35,
                  ['--petal-drift' as string]: `${p.drift}px`,
                  ['--petal-op' as string]: String(p.opacity),
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                }
          }
          viewBox="0 0 24 40"
        >
          <path fill="currentColor" d={PETAL_PATH} transform="translate(2 4) scale(0.85)" />
        </svg>
      ))}
    </div>
  )
}
