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

const PLACEHOLDER_UNSPLASH_PATHS = new Set(
  FALLBACK_COVERS.map((u) => {
    try {
      const p = new URL(u).pathname
      return p
    } catch {
      return u
    }
  })
)

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

function sanitizeUrl(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Seeded generic Unsplash image shouldn't override a salon's real photo source. */
function isSeedPlaceholderImage(url: string): boolean {
  if (!url) return true
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('images.unsplash.com')) return false
    return PLACEHOLDER_UNSPLASH_PATHS.has(parsed.pathname)
  } catch {
    return false
  }
}

/** يدعم cover_image و image_url و google_photo_resource (صور Google بدون تخزين المفتاح في DB) */
export function resolveBusinessCoverImage(b: {
  id?: string | null
  cover_image?: string | null
  image_url?: string | null
  images?: string[] | null
  google_photo_resource?: string | null
}): string {
  const fromGoogle = sanitizeUrl(googlePlacePhotoMediaUrl(b.google_photo_resource))
  if (fromGoogle) return fromGoogle

  const fromImageUrl = sanitizeUrl((b as { image_url?: string }).image_url)
  if (fromImageUrl && !isSeedPlaceholderImage(fromImageUrl)) return fromImageUrl

  const fromImages =
    b.images?.map((u) => sanitizeUrl(u)).find((u) => u && !isSeedPlaceholderImage(u)) ?? ''
  if (fromImages) return fromImages

  const fromCover = sanitizeUrl(b.cover_image)
  if (fromCover && !isSeedPlaceholderImage(fromCover)) return fromCover

  return b.id ? fallbackCoverForBusinessId(b.id) : DEFAULT_BUSINESS_COVER_IMAGE
}
