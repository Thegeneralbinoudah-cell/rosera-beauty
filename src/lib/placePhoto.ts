import { getGoogleMapsApiKey } from '@/lib/googleMapsEnv'

/** رابط صورة Place (New) — المفتاح يبقى في العميل فقط، لا يُخزَّن في قاعدة البيانات */
export function googlePlacePhotoMediaUrl(photoResourceName: string | null | undefined): string | null {
  const name = photoResourceName?.trim()
  if (!name) return null
  const key = getGoogleMapsApiKey().trim()
  if (!key) return null
  return `https://places.googleapis.com/v1/${name}/media?maxHeightPx=800&maxWidthPx=1200&key=${encodeURIComponent(key)}`
}
