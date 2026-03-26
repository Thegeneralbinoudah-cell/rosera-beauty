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
  /**
   * يُعرض دائماً كدبوس فردي (لا يُدخل التجميع) — أعلى التقييم، مميز، أو اشتراك بريميوم.
   */
  priority?: boolean
  /** تمييز خفيف لاقتراح روزي النشط (لا يغيّر التجميع) */
  suggestionBoost?: boolean
}

/** أقرب N علامة إلى مرجع الخريطة (Google Maps) */
/** Same string as MapPage `mapMarkersSignature` — used by mapMarkerStore.applyMarkerRows */
export function buildMapMarkersSignature(markers: MapMarkerRow[]): string {
  return markers
    .map((m) => {
      const la = m.position[0]
      const ln = m.position[1]
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return ''
      const r = typeof m.rating === 'number' && Number.isFinite(m.rating) ? m.rating : 0
      return `${m.id}:${la.toFixed(5)},${ln.toFixed(5)}:${m.pinRatingLabel}:${r.toFixed(2)}:${m.tier ?? 'default'}:${m.priority ? 'p' : 'n'}:${m.suggestionBoost ? 's' : 'n'}`
    })
    .filter(Boolean)
    .join('|')
}

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
