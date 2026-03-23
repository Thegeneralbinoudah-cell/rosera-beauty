/**
 * روابط الخريطة من حالات الفراغ والـ CTA:
 * - sort=nearest لعرض الأقرب
 * - q لنص البحث
 * - city لاسم المدينة المختارة (يتوافق مع فلتر الخريطة)
 */
export function buildMapExploreUrl(opts?: {
  sortNearest?: boolean
  searchQuery?: string | null
  city?: string | null
}): string {
  const p = new URLSearchParams()
  if (opts?.sortNearest) p.set('sort', 'nearest')
  const q = opts?.searchQuery?.trim()
  if (q) p.set('q', q)
  const city = opts?.city?.trim()
  if (city) p.set('city', city)
  const qs = p.toString()
  return qs ? `/map?${qs}` : '/map'
}
