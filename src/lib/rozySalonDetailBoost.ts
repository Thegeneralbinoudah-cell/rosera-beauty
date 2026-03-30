/** Signals Edge `rozi-chat` to use stronger booking CTA after user opens salon detail from chat. */
const KEY = 'rosera_rozy_salon_detail_boost_v1'
const TTL_MS = 20 * 60 * 1000

export function markRozySalonDetailBookingBoost(salonId: string): void {
  const id = salonId?.trim()
  if (!id) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ salonId: id, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** True while boost window is active — sent on each `rozi-chat` invoke. */
export function postSalonDetailBookingBoostActive(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return false
    const o = JSON.parse(raw) as { at?: number }
    if (typeof o.at !== 'number' || !Number.isFinite(o.at)) return false
    return Date.now() - o.at < TTL_MS
  } catch {
    return false
  }
}
