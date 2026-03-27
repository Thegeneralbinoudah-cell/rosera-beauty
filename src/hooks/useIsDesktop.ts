import { useMediaQuery } from '@/hooks/useMediaQuery'

/** `true` when viewport is at least 1024px — use for desktop-only interaction (magnetic, ripple), not layout. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
