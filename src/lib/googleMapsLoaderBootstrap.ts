/**
 * Clears a stuck or half-loaded Maps `<script>` so `@googlemaps/js-api-loader` can
 * bootstrap again. Helps dev/HMR and rare cases where tiles show "No imagery" until reload.
 * Safe to call only before the first successful `setOptions()` in a page session.
 */
export function clearStaleGoogleMapsScript(): void {
  if (typeof document === 'undefined') return
  /** إذا وُجدت واجهة maps فلا نزيل السكربت — تجنّب كسر جلسة محمّلة */
  if (typeof window !== 'undefined' && window.google?.maps) return
  document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]').forEach((el) => {
    el.parentNode?.removeChild(el)
  })
}
