import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'
import type { MapFilterDrawerCategoryId } from '@/lib/mapFilterDrawerConfig'

export type MapDrawerSelections = Partial<Record<MapFilterDrawerCategoryId, string[]>>

/** تقدير تقريبي لنطاق السعر من النص (ريال) */
function roughPriceSar(b: Business): number | null {
  const pr = (b.price_range ?? '').trim()
  if (!pr) return null
  const digits = pr.match(/\d{2,4}/)
  if (digits) {
    const n = Number(digits[0])
    if (Number.isFinite(n)) return n
  }
  if (/^[\$₹]+$/.test(pr)) {
    const level = pr.replace(/\s/g, '').length
    if (level <= 1) return 80
    if (level === 2) return 200
    return 380
  }
  if (/اقتصادي|رخيص|منخفض|economic|low|رخيصة/i.test(pr)) return 80
  if (/فاخر|مرتفع|luxury|premium|غالي|عالي/i.test(pr)) return 380
  return null
}

function minDistanceKmFromSelections(sel: string[] | undefined): number | null {
  if (!sel?.length) return null
  const kms: number[] = []
  if (sel.includes('dist_1')) kms.push(1)
  if (sel.includes('dist_3')) kms.push(3)
  if (sel.includes('dist_5')) kms.push(5)
  if (kms.length === 0) return null
  return Math.min(...kms)
}

/**
 * مرشحات درج الفلاتر — تُستدعى بعد فلترة النص/المنطقة/الإحداثيات.
 */
export function applyMapDrawerFilters(
  rows: Business[],
  drawer: MapDrawerSelections,
  userPos: [number, number] | null,
): Business[] {
  let out = rows

  const hi = drawer.highest_rated
  if (hi?.length) {
    if (hi.includes('stars_5')) {
      out = out.filter((b) => Number(b.average_rating ?? 0) >= 4.85)
    } else if (hi.includes('stars_4')) {
      out = out.filter((b) => Number(b.average_rating ?? 0) >= 4.0)
    }
    if (hi.includes('most_reviewed')) {
      out = out.filter((b) => Number(b.total_reviews ?? 0) >= 6)
    }
  }

  const near = drawer.nearest
  const maxKm = minDistanceKmFromSelections(near)
  if (maxKm != null && userPos && userPos.length >= 2) {
    out = out.filter((b) => {
      const la = b.latitude
      const ln = b.longitude
      if (la == null || ln == null) return false
      return haversineKm(userPos[0], userPos[1], Number(la), Number(ln)) <= maxKm
    })
  }

  const val = drawer.best_value
  if (val?.length) {
    const wantLow = val.includes('price_low')
    const wantMid = val.includes('price_mid')
    const wantHigh = val.includes('price_high')
    if (wantLow || wantMid || wantHigh) {
      out = out.filter((b) => {
        const p = roughPriceSar(b)
        if (p == null) return true
        return (
          (wantLow && p < 100) ||
          (wantMid && p >= 100 && p <= 300) ||
          (wantHigh && p > 300)
        )
      })
    }
  }

  const booked = drawer.most_booked
  if (booked?.length) {
    let minBook = 0
    if (booked.includes('booked_today')) minBook = Math.max(minBook, 2)
    if (booked.includes('booked_week')) minBook = Math.max(minBook, 1)
    if (minBook > 0) {
      out = out.filter((b) => Number(b.total_bookings ?? 0) >= minBook)
    }
  }

  const qb = drawer.quick_book
  if (qb?.length) {
    out = out.filter(
      (b) => Boolean(b.is_featured) || b.subscription_plan === 'premium' || Number(b.total_bookings ?? 0) > 0,
    )
  }

  const rozy = drawer.rozy_pick
  if (rozy?.length) {
    if (rozy.includes('ai_new')) {
      const cutoff = Date.now() - 90 * 24 * 3600 * 1000
      out = out.filter((b) => {
        if (!b.created_at) return false
        const t = new Date(b.created_at).getTime()
        return Number.isFinite(t) && t >= cutoff
      })
    }
    if (rozy.includes('ai_satisfaction')) {
      out = out.filter(
        (b) => Number(b.average_rating ?? 0) >= 4.5 && Number(b.total_reviews ?? 0) >= 5,
      )
    }
  }

  return out
}

export const MAP_DRAWER_CATEGORY_TO_SORT = {
  highest_rated: 'rating',
  most_booked: 'booked',
  nearest: 'nearest',
  best_value: 'value',
  quick_book: 'smart',
  rozy_pick: 'smart',
} as const satisfies Partial<
  Record<MapFilterDrawerCategoryId, 'rating' | 'booked' | 'nearest' | 'value' | 'smart'>
>
