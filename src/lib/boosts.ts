import { supabase } from '@/lib/supabase'

/** Percent 0–25; ranking applies min(MAX_POINTS, baseScore * pct/100). */
export type BoostMeta = {
  pct: number
  boost_type: 'featured' | 'priority'
}

export type BoostContext = {
  businessBoost: Map<string, BoostMeta>
  productBoost: Map<string, BoostMeta>
}

function betterMeta(a: BoostMeta, b: BoostMeta): BoostMeta {
  if (Math.abs(a.pct - b.pct) > 0.01) return a.pct > b.pct ? a : b
  if (a.boost_type === 'featured' && b.boost_type !== 'featured') return a
  if (b.boost_type === 'featured' && a.boost_type !== 'featured') return b
  return a
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Active boosts in the current calendar day window (RLS: public active policy). */
export async function fetchBoostContext(): Promise<BoostContext> {
  const t = todayISO()
  const { data, error } = await supabase
    .from('boosts')
    .select('business_id, product_id, boost_score, boost_type')
    .eq('is_active', true)
    .lte('start_date', t)
    .gte('end_date', t)

  const businessBoost = new Map<string, BoostMeta>()
  const productBoost = new Map<string, BoostMeta>()

  if (error || !data?.length) {
    return { businessBoost, productBoost }
  }

  for (const row of data as {
    business_id: string | null
    product_id: string | null
    boost_score: number | string | null
    boost_type: string
  }[]) {
    const pct = Math.min(25, Math.max(0, Number(row.boost_score ?? 0)))
    const bt = row.boost_type === 'featured' ? 'featured' : 'priority'
    const meta: BoostMeta = { pct, boost_type: bt }

    if (row.product_id) {
      const prev = productBoost.get(row.product_id)
      productBoost.set(row.product_id, prev ? betterMeta(prev, meta) : meta)
    } else if (row.business_id) {
      const prev = businessBoost.get(row.business_id)
      businessBoost.set(row.business_id, prev ? betterMeta(prev, meta) : meta)
    }
  }

  return { businessBoost, productBoost }
}

export async function fetchSponsoredBusinessIds(ids: string[]): Promise<Set<string>> {
  const m = await fetchActiveBusinessBoostMeta(ids)
  return new Set(m.keys())
}

/** Per-business active salon boost (for badges); merges overlapping rows (featured wins ties). */
export async function fetchActiveBusinessBoostMeta(ids: string[]): Promise<Map<string, BoostMeta>> {
  if (!ids.length) return new Map()
  const t = todayISO()
  const { data } = await supabase
    .from('boosts')
    .select('business_id, boost_score, boost_type')
    .eq('is_active', true)
    .lte('start_date', t)
    .gte('end_date', t)
    .is('product_id', null)
    .in('business_id', ids)
  const businessBoost = new Map<string, BoostMeta>()
  for (const row of data ?? []) {
    const bid = (row as { business_id: string | null }).business_id
    if (!bid) continue
    const pct = Math.min(25, Math.max(0, Number((row as { boost_score?: number | string }).boost_score ?? 0)))
    const bt = (row as { boost_type: string }).boost_type === 'featured' ? 'featured' : 'priority'
    const meta: BoostMeta = { pct, boost_type: bt }
    const prev = businessBoost.get(bid)
    businessBoost.set(bid, prev ? betterMeta(prev, meta) : meta)
  }
  return businessBoost
}

export async function fetchSponsoredProductIds(ids: string[]): Promise<Set<string>> {
  const m = await fetchActiveProductBoostMeta(ids)
  return new Set(m.keys())
}

export async function fetchActiveProductBoostMeta(ids: string[]): Promise<Map<string, BoostMeta>> {
  if (!ids.length) return new Map()
  const t = todayISO()
  const { data } = await supabase
    .from('boosts')
    .select('product_id, boost_score, boost_type')
    .eq('is_active', true)
    .lte('start_date', t)
    .gte('end_date', t)
    .not('product_id', 'is', null)
    .in('product_id', ids)
  const productBoost = new Map<string, BoostMeta>()
  for (const row of data ?? []) {
    const pid = (row as { product_id: string | null }).product_id
    if (!pid) continue
    const pct = Math.min(25, Math.max(0, Number((row as { boost_score?: number | string }).boost_score ?? 0)))
    const bt = (row as { boost_type: string }).boost_type === 'featured' ? 'featured' : 'priority'
    const meta: BoostMeta = { pct, boost_type: bt }
    const prev = productBoost.get(pid)
    productBoost.set(pid, prev ? betterMeta(prev, meta) : meta)
  }
  return productBoost
}
