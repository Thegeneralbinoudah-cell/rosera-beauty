import { supabase, type Business } from '@/lib/supabase'

export type LatLngBoundsBox = {
  north: number
  south: number
  east: number
  west: number
}

export function boundsToLatLngBox(bounds: google.maps.LatLngBounds): LatLngBoundsBox {
  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  return { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() }
}

/** Supabase fetch for businesses inside the current map viewport (no map remount). */
export async function fetchSalonsInBounds(
  bounds: LatLngBoundsBox,
  opts?: { signal?: AbortSignal },
): Promise<Business[]> {
  const { north, south, east, west } = bounds
  if (![north, south, east, west].every((n) => Number.isFinite(n))) {
    return []
  }
  let q = supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true)
    .eq('is_demo', false)
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)

  if (opts?.signal) q = q.abortSignal(opts.signal)

  const { data, error } = await q

  if (error) throw error
  return Array.isArray(data) ? (data as Business[]) : []
}
