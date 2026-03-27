import { useMediaQuery } from '@/hooks/useMediaQuery'

/** `true` when `(prefers-reduced-motion: reduce)` — uses `window.matchMedia` + `change` listener. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
