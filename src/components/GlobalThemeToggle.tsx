import { DarkModeToggle } from '@/components/DarkModeToggle'

/**
 * Fixed top-trailing corner — logical `end` avoids overlap with `FloatingBackButton`
 * on the start side (RTL: back right, toggle left).
 */
export function GlobalThemeToggle() {
  return (
    <div
      className="pointer-events-none fixed z-floating"
      style={{
        top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
        insetInlineEnd: 'max(0.75rem, env(safe-area-inset-end, 0px))',
      }}
    >
      <div className="pointer-events-auto">
        <DarkModeToggle />
      </div>
    </div>
  )
}
