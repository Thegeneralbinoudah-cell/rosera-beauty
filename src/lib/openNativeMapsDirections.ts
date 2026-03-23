/**
 * Opens the user's preferred maps app (Apple Maps on iOS, Google Maps elsewhere)
 * with directions/search to the given coordinates.
 */
export function openNativeMapsDirections(lat: number | null | undefined, lng: number | null | undefined, label?: string): void {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1)

  const q = label?.trim() ? `&q=${encodeURIComponent(label.trim())}` : ''

  if (isIOS) {
    const apple = `https://maps.apple.com/?daddr=${la},${ln}${q}`
    const w = window.open(apple, '_blank', 'noopener,noreferrer')
    if (!w) window.location.href = apple
    return
  }

  const google = `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}`
  const w = window.open(google, '_blank', 'noopener,noreferrer')
  if (!w) window.location.href = google
}
