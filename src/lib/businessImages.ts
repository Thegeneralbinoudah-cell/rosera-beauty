import { googlePlacePhotoMediaUrl } from '@/lib/placePhoto'

/** صورة افتراضية عند غياب cover_image / الصور في قاعدة البيانات */
export const DEFAULT_BUSINESS_COVER_IMAGE =
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80&auto=format&fit=crop'

const FALLBACK_COVERS = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80&auto=format&fit=crop',
]

function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h
}

export function fallbackCoverForBusinessId(id: string): string {
  const idx = Math.abs(simpleHash(id)) % FALLBACK_COVERS.length
  return FALLBACK_COVERS[idx]
}

/** يدعم cover_image و image_url و google_photo_resource (صور Google بدون تخزين المفتاح في DB) */
export function resolveBusinessCoverImage(b: {
  id?: string | null
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
  if (!raw) return b.id ? fallbackCoverForBusinessId(b.id) : DEFAULT_BUSINESS_COVER_IMAGE
  return raw
}
