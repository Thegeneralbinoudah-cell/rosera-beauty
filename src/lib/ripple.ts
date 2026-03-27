import type { MouseEvent } from 'react'

/** Material-style ripple — append-only; span removed after animation. */
export function attachRipple(e: MouseEvent<HTMLElement>): void {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const circle = document.createElement('span')
  const size = Math.max(rect.width, rect.height) * 1.2
  circle.className = 'ripple-pulse'
  circle.style.width = `${size}px`
  circle.style.height = `${size}px`
  circle.style.left = `${e.clientX - rect.left - size / 2}px`
  circle.style.top = `${e.clientY - rect.top - size / 2}px`
  el.appendChild(circle)
  window.setTimeout(() => circle.remove(), 600)
}

export const rippleSurfaceClass = 'ripple relative overflow-hidden'
