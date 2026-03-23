import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { SALON_FEATURED_AD_SAR_PER_DAY } from '@/lib/salonPricingModel'

/** Extra AI ranking points while a featured ad is active (between Pro subscription and Premium stack). */
export const FEATURED_AD_AI_RANK_BOOST = 58

export { SALON_FEATURED_AD_SAR_PER_DAY }

export function featuredAdTotalSar(days: number): number {
  const d = Math.max(1, Math.min(60, Math.floor(days)))
  return d * SALON_FEATURED_AD_SAR_PER_DAY
}

/** Salon IDs with an active paid featured ad (calendar window). */
export async function fetchActiveSalonFeaturedAdSalonIds(salonIds: string[]): Promise<Set<string>> {
  const set = new Set<string>()
  if (!isSupabaseConfigured || !salonIds.length) return set

  void supabase.rpc('expire_salon_ads').then(
    () => {},
    () => {}
  )

  const t = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('salon_ads')
    .select('salon_id')
    .in('salon_id', salonIds)
    .eq('status', 'active')
    .lte('start_date', t)
    .gte('end_date', t)

  if (error || !data?.length) return set
  for (const row of data) {
    const id = (row as { salon_id: string }).salon_id
    if (id) set.add(id)
  }
  return set
}

export async function salonHasActiveFeaturedAd(salonId: string): Promise<boolean> {
  const s = await fetchActiveSalonFeaturedAdSalonIds([salonId])
  return s.has(salonId)
}

/** Featured-ad rows first; preserves order within each group. */
export function partitionSalonsWithFeaturedAdsFirst<T extends { id: string }>(
  rows: T[],
  featuredSalonIds: ReadonlySet<string>
): T[] {
  const head: T[] = []
  const tail: T[] = []
  for (const r of rows) {
    if (featuredSalonIds.has(r.id)) head.push(r)
    else tail.push(r)
  }
  return [...head, ...tail]
}
