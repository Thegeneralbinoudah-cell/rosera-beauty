import { supabase } from '@/lib/supabase'

export type SalonActiveOffer = {
  id: string
  discount_percentage: number
  title: string | null
}

export type OfferRow = {
  id: string
  business_id: string
  discount_percentage: number | string | null
  title?: string | null
  title_ar?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean | null
}

export function isOfferActiveForToday(row: {
  is_active?: boolean | null
  start_date?: string | null
  end_date?: string | null
}): boolean {
  if (row.is_active === false) return false
  const today = new Date().toISOString().slice(0, 10)
  if (row.start_date && String(row.start_date).slice(0, 10) > today) return false
  if (row.end_date && String(row.end_date).slice(0, 10) < today) return false
  return true
}

export function pickBestActiveOffer(rows: OfferRow[]): SalonActiveOffer | null {
  let best: SalonActiveOffer | null = null
  let bestPct = -1
  for (const row of rows) {
    if (!row?.business_id || !row.id) continue
    if (!isOfferActiveForToday(row)) continue
    const pct = Number(row.discount_percentage)
    if (!Number.isFinite(pct) || pct <= 0) continue
    const clamped = Math.min(100, Math.max(0, pct))
    if (clamped <= bestPct) continue
    bestPct = clamped
    const title =
      (typeof row.title === 'string' && row.title.trim()) ||
      (typeof row.title_ar === 'string' && row.title_ar.trim()) ||
      null
    best = { id: row.id, discount_percentage: clamped, title }
  }
  return best
}

export async function fetchBestActiveOffersByBusinessIds(
  businessIds: string[]
): Promise<Map<string, SalonActiveOffer>> {
  const map = new Map<string, SalonActiveOffer>()
  const ids = [...new Set(businessIds.filter(Boolean))]
  if (!ids.length) return map

  const { data, error } = await supabase
    .from('offers')
    .select('id, business_id, discount_percentage, title, title_ar, start_date, end_date, is_active')
    .eq('is_active', true)
    .in('business_id', ids)

  if (error || !data?.length) return map

  const byBiz = new Map<string, OfferRow[]>()
  for (const raw of data) {
    const row = raw as OfferRow
    const bid = row.business_id
    if (!bid) continue
    if (!isOfferActiveForToday(row)) continue
    const list = byBiz.get(bid) ?? []
    list.push(row)
    byBiz.set(bid, list)
  }

  for (const [bid, list] of byBiz) {
    const best = pickBestActiveOffer(list)
    if (best) map.set(bid, best)
  }
  return map
}
