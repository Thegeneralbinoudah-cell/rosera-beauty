import { googlePlacePhotoMediaUrl } from '@/lib/placePhoto'

/** صورة افتراضية عند غياب cover_image / الصور في قاعدة البيانات */
export const DEFAULT_BUSINESS_COVER_IMAGE =
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80&auto=format&fit=crop'

/** يدعم cover_image و image_url و google_photo_resource (صور Google بدون تخزين المفتاح في DB) */
export function resolveBusinessCoverImage(b: {
  cover_image?: string | null
  image_url?: string | null
  images?: string[] | null
  google_photo_resource?: string | null
}): string {
  const fromImages = b.images?.find((u) => typeof u === 'string' && u.trim().length > 0)
  const fromGoogle = googlePlacePhotoMediaUrl(b.google_photo_resource)
  const raw = (
    (b.cover_image || '').trim() ||
    (fromGoogle || '').trim() ||
    ((b as { image_url?: string }).image_url || '').trim() ||
    (fromImages || '').trim()
  ).trim()
  if (!raw) return DEFAULT_BUSINESS_COVER_IMAGE
  return raw
}
