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
  /** يطابق نفس قيمة `categoryLabel` في البحث والخرائط */
  categoryLabel?: string | null
  /** اختصار أو معرف اقتراح روزي — يُطبَّق عند فتح الخريطة (`near`، `value`، `rosy_skin`، …) */
  rosy?: string | null
}): string {
  const p = new URLSearchParams()
  if (opts?.sortNearest) p.set('sort', 'nearest')
  const q = opts?.searchQuery?.trim()
  if (q) p.set('q', q)
  const city = opts?.city?.trim()
  if (city) p.set('city', city)
  const cat = opts?.categoryLabel?.trim()
  if (cat) p.set('categoryLabel', cat)
  const rosy = opts?.rosy?.trim()
  if (rosy) p.set('rosy', rosy)
  const qs = p.toString()
  return qs ? `/map?${qs}` : '/map'
}
