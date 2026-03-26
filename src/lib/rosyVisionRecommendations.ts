import { supabase, type Business, type Service } from '@/lib/supabase'
import { filterFemaleBeautyBusinesses } from '@/lib/roseraBusinessFilters'
import { haversineKm } from '@/lib/utils'

export type RosyVisionSalonPack = {
  businesses: (Business & { distanceKm?: number })[]
  /** Sample bookable services matching nail vs hair/color intent */
  sampleServices: Pick<Service, 'id' | 'name_ar' | 'business_id' | 'price' | 'duration_minutes'>[]
}

/** ILIKE patterns for `services.name_ar` — manicure / nails */
const HAND_SERVICE_OR = [
  'name_ar.ilike.%أظافر%',
  'name_ar.ilike.%مناكير%',
  'name_ar.ilike.%مانيكير%',
  'name_ar.ilike.%أظافر صناعية%',
  'name_ar.ilike.%بديكير%',
  'name_ar.ilike.%جل أظافر%',
].join(',')

/** Hair color / styling / cut / consultation-friendly names */
const FACE_SERVICE_OR = [
  'name_ar.ilike.%صبغ%',
  'name_ar.ilike.%صبغة%',
  'name_ar.ilike.%تلوين%',
  'name_ar.ilike.%هايلايت%',
  'name_ar.ilike.%مسات شعر%',
  'name_ar.ilike.%كراتين%',
  'name_ar.ilike.%صبغة شعر%',
  'name_ar.ilike.%قص شعر%',
  'name_ar.ilike.%قصّ%',
  'name_ar.ilike.%قص %',
  'name_ar.ilike.%تسريحة%',
  'name_ar.ilike.%ستايل%',
  'name_ar.ilike.%استشارة%',
  'name_ar.ilike.%بروتين%',
].join(',')

const HAND_BIZ_FALLBACK_OR = [
  'name_ar.ilike.%أظافر%',
  'name_ar.ilike.%مناكير%',
  'description_ar.ilike.%أظافر%',
].join(',')

const FACE_BIZ_FALLBACK_OR = [
  'name_ar.ilike.%صبغ%',
  'name_ar.ilike.%شعر%',
  'description_ar.ilike.%صبغ%',
].join(',')

function boostScoreForBusiness(
  b: Pick<Business, 'name_ar' | 'description_ar'>,
  serviceNamesForBiz: string[],
  keywords: string[],
): number {
  if (keywords.length === 0) return 0
  const hay = `${b.name_ar} ${b.description_ar ?? ''} ${serviceNamesForBiz.join(' ')}`.toLowerCase()
  let score = 0
  for (const k of keywords) {
    const t = k.trim().toLowerCase()
    if (t.length < 2) continue
    if (hay.includes(t)) score += 3
  }
  return score
}

/** Re-rank: higher boost from saved style keywords first, then distance. */
function resortWithPersonalization(
  sorted: (Business & { distanceKm?: number })[],
  svcRows: { business_id: string; name_ar: string }[],
  boostKeywords: string[],
): (Business & { distanceKm?: number })[] {
  if (boostKeywords.length === 0) return sorted
  const svcByBiz = new Map<string, string[]>()
  for (const s of svcRows) {
    const arr = svcByBiz.get(s.business_id) ?? []
    arr.push(s.name_ar)
    svcByBiz.set(s.business_id, arr)
  }
  return [...sorted].sort((a, b) => {
    const sa = boostScoreForBusiness(a, svcByBiz.get(a.id) ?? [], boostKeywords)
    const sb = boostScoreForBusiness(b, svcByBiz.get(b.id) ?? [], boostKeywords)
    if (sa !== sb) return sb - sa
    const da = a.distanceKm ?? 1e9
    const db = b.distanceKm ?? 1e9
    return da - db
  })
}

function sortByDistance(
  rows: Business[],
  userPos: { lat: number; lng: number } | null,
): (Business & { distanceKm?: number })[] {
  if (!userPos) {
    return rows.map((b) => ({ ...b }))
  }
  return [...rows]
    .map((b) => {
      const lat = b.latitude
      const lng = b.longitude
      if (lat == null || lng == null) return { ...b, distanceKm: undefined as number | undefined }
      return { ...b, distanceKm: haversineKm(userPos.lat, userPos.lng, lat, lng) }
    })
    .sort((a, b) => {
      const da = a.distanceKm ?? 1e9
      const db = b.distanceKm ?? 1e9
      return da - db
    })
}

/**
 * Nearby salons + sample services after Rosy Vision (hand = nails, face = hair/color).
 */
export async function fetchRosyVisionSalonRecommendations(args: {
  mode: 'hand' | 'face'
  userPos: { lat: number; lng: number } | null
  /** From saved Rosy Vision styles — boosts matching salons/services */
  boostKeywords?: string[]
}): Promise<RosyVisionSalonPack> {
  const { mode, userPos, boostKeywords = [] } = args
  const serviceOr = mode === 'hand' ? HAND_SERVICE_OR : FACE_SERVICE_OR

  const { data: svcRows, error: svcErr } = await supabase
    .from('services')
    .select('id, name_ar, business_id, price, duration_minutes')
    .eq('is_active', true)
    .or(serviceOr)
    .limit(80)

  let businessIds = [...new Set((svcRows ?? []).map((r) => r.business_id))]

  if (svcErr || businessIds.length === 0) {
    const bizOr = mode === 'hand' ? HAND_BIZ_FALLBACK_OR : FACE_BIZ_FALLBACK_OR
    const { data: bizFallback } = await supabase
      .from('businesses')
      .select(
        `
        *,
        sa_cities ( name_ar, sa_regions ( name_ar ) )
      `,
      )
      .eq('is_active', true)
      .eq('is_demo', false)
      .or(bizOr)
      .limit(24)

    const filtered = filterFemaleBeautyBusinesses((bizFallback ?? []) as Business[])
    const sortedBase = sortByDistance(filtered, userPos)
    const sorted = resortWithPersonalization(sortedBase, [], boostKeywords).slice(0, 8)
    return {
      businesses: sorted,
      sampleServices: [],
    }
  }

  const { data: bizRows, error: bizErr } = await supabase
    .from('businesses')
    .select(
      `
      *,
      sa_cities ( name_ar, sa_regions ( name_ar ) )
    `,
    )
    .in('id', businessIds)
    .eq('is_active', true)
    .eq('is_demo', false)

  if (bizErr || !bizRows?.length) {
    return { businesses: [], sampleServices: [] }
  }

  const filtered = filterFemaleBeautyBusinesses(bizRows as Business[])
  const sortedBase = sortByDistance(filtered, userPos)
  const sorted = resortWithPersonalization(sortedBase, svcRows ?? [], boostKeywords).slice(0, 8)

  const keepIds = new Set(sorted.map((b) => b.id))
  const svcList = (svcRows ?? []).filter((s) => keepIds.has(s.business_id))
  /** One matched service per ranked salon (same order) — reliable direct booking for الأقرب. */
  const sampleServices: RosyVisionSalonPack['sampleServices'] = []
  for (const b of sorted) {
    const hit = svcList.find((s) => s.business_id === b.id)
    if (hit) sampleServices.push(hit)
  }

  return { businesses: sorted, sampleServices }
}

export function rosyVisionMapSearchQuery(mode: 'hand' | 'face'): string {
  return mode === 'hand' ? 'أظافر مناكير' : 'صبغ شعر'
}

/**
 * First salon in ranking order that has a Rosy-matched bookable service (for direct booking).
 */
export function pickRozyVisionBookTarget(
  businesses: { id: string }[],
  sampleServices: Pick<Service, 'id' | 'business_id'>[],
): { salonId: string; serviceId: string } | null {
  for (const b of businesses) {
    const s = sampleServices.find((x) => x.business_id === b.id)
    if (s) return { salonId: b.id, serviceId: s.id }
  }
  return null
}
