/**
 * Curated Saudi region images by Arabic region name.
 * Fallback to DB `image_url` when no mapping is found.
 */

function normalizeRegionName(name: string): string {
  return name
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(?:منطقة|المنطقة)\s+/, '')
    .trim()
}

const SAUDI_REGION_IMAGE_BY_NAME: Record<string, string> = {
  الرياض: '/regions/riyadh.jpg',
  'مكة المكرمة': '/regions/makkah.jpg',
  'المدينة المنورة': '/regions/madinah.jpg',
  القصيم: '/regions/qassim.jpg',
  الشرقية: '/regions/eastern.jpg',
  عسير: '/regions/asir.png',
  تبوك: '/regions/tabuk.jpg',
  حائل: '/regions/hail.jpg',
  'الحدود الشمالية': '/regions/northern-borders.jpg',
  جازان: '/regions/jazan.jpg',
  نجران: '/regions/najran.jpg',
  الباحة: '/regions/baha.jpg',
  الجوف: '/regions/jouf.jpg',
}

export function resolveSaudiRegionImage(regionNameAr: string, fallbackImageUrl: string): string {
  const key = normalizeRegionName(regionNameAr)
  return SAUDI_REGION_IMAGE_BY_NAME[key] || fallbackImageUrl
}

