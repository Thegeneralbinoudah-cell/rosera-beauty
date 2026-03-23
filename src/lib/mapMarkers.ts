import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'

/**
 * سقف احتياطي إن أردت لاحقاً تقييد العلامات (الخريطة تعرض حالياً الكل من MapPage).
 */
export const MAX_MARKERS = 2000

export type MapMarkerRow = {
  id: string
  b: Business
  position: [number, number]
  rating: number
  /** تقييم على الدبوس — مُنسَّق (مثلاً ar-SA) */
  pinRatingLabel: string
  /** أعلى 3 صالونات حسب التقييم ضمن النتائج الظاهرة */
  tier?: 'top' | 'default'
}

/** أقرب N علامة إلى مرجع الخريطة (Google Maps) */
export function limitMarkersNearest(
  markers: MapMarkerRow[],
  refLat: number,
  refLng: number,
  max = MAX_MARKERS
): MapMarkerRow[] {
  if (markers.length <= max) return markers
  return [...markers]
    .sort(
      (a, b) =>
        haversineKm(refLat, refLng, a.position[0], a.position[1]) -
        haversineKm(refLat, refLng, b.position[0], b.position[1])
    )
    .slice(0, max)
}
