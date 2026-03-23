import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'

/**
 * أقرب N علامة إلى مركز الخريطة البرمجي — يُبقي الواجهة سلسة على الأجهزة.
 * استيراد كامل المنشآت للشرقية سيكون لاحقاً عبر سكربت → Supabase.
 */
export const MAX_MARKERS = 50

export type MapMarkerRow = {
  id: string
  b: Business
  position: [number, number]
  rating: number
  /** تقييم على الدبوس — مُنسَّق (مثلاً ar-SA) */
  pinRatingLabel: string
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
