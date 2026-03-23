import type { Business } from '@/lib/supabase'
import { hasFemaleOrFamilyBeautySignal, isMaleOnlyBeautyBusiness } from '@/lib/roseraBusinessFilters'

/** Places API (New) — field mask for searchText */
const FIELD_MASK =
  'places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.formattedAddress,places.types,places.googleMapsUri,places.photos,places.internationalPhoneNumber'

type PlaceRow = {
  id?: string
  displayName?: { text?: string }
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  formattedAddress?: string
  types?: string[]
  googleMapsUri?: string
  photos?: { name?: string }[]
  internationalPhoneNumber?: string
}

function photoMediaUrl(photoResourceName: string, apiKey: string): string {
  return `https://places.googleapis.com/v1/${photoResourceName}/media?maxHeightPx=800&maxWidthPx=1200&key=${encodeURIComponent(apiKey)}`
}

/**
 * استبعاد الحلاقة الرجالية التي Google يصنّفها أحياناً beauty_salon / hair_care.
 * - بحث قريب (nearby): صارم — بدون «نسائي / سبا / أظافر…» لا يُقبل صالون الشعر العام.
 * - استعلام نصي «صالون نسائي»: أكثر تساهلاً لأن السياق نسائي.
 */
function isLikelyFemaleBeautySalon(
  name: string,
  types: string[] | undefined,
  opts?: { fromLadiesTextQuery?: boolean }
): boolean {
  const n = name.toLowerCase()
  const tList = types ?? []
  const t = tList.join(' ').toLowerCase()

  if (isMaleOnlyBeautyBusiness({ name_ar: name, name_en: name, category: '', category_label: '' })) return false
  if (/gym|fitness/.test(t)) return false
  if (/barber|barbershop/.test(t) && !/beauty|spa|hair_salon/.test(t)) return false

  const strongFemaleTypes = tList.some((x) => ['spa', 'nail_salon', 'cosmetics_store'].includes(x))
  if (strongFemaleTypes) return true

  if (hasFemaleOrFamilyBeautySignal({ name_ar: name, name_en: name })) return true

  const okType = tList.some((x) =>
    ['beauty_salon', 'spa', 'hair_care', 'nail_salon', 'cosmetics_store'].includes(x)
  )

  if (opts?.fromLadiesTextQuery) {
    // بحث نصي صريح «نسائي» — نبقى صارمين: لا حلاقة/رجال، ونفضّل إشارة نسائية أو نوع سبا/أظافر
    if (strongFemaleTypes) return true
    if (hasFemaleOrFamilyBeautySignal({ name_ar: name, name_en: name })) return true
    if (tList.includes('barber_shop')) return false
    if (/\bbarber\b/i.test(n) || /حلاق|للرجال|رجال\s*فقط|gents|men'?s\s+(salon|barber)/i.test(n)) return false
    if (okType) return true
    if (/صالون|مشغل|سبا|تجميل|مركز|beauty|spa|nail|salon|مكياج|بشرة/i.test(n)) return true
    return false
  }

  if (tList.includes('beauty_salon') || tList.includes('hair_care')) return false

  if (!okType && /صالون|سبا|beauty|spa|nail|salon|مشغل/i.test(n)) return false

  return okType
}

function placeToBusiness(
  p: PlaceRow,
  cityAr: string,
  apiKey: string,
  opts?: { fromLadiesTextQuery?: boolean }
): Business | null {
  const id = p.id
  const name = p.displayName?.text?.trim()
  const lat = p.location?.latitude
  const lng = p.location?.longitude
  if (!id || !name || typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!isLikelyFemaleBeautySalon(name, p.types, opts)) return null

  const photoName = p.photos?.[0]?.name
  const coverFromPlace = photoName ? photoMediaUrl(photoName, apiKey) : undefined

  const safeId = `gplace:${encodeURIComponent(id)}`
  const phone = p.internationalPhoneNumber?.trim() || undefined
  return {
    id: safeId,
    name_ar: name,
    name_en: name,
    description_ar: 'نتيجة من خرائط Google — للاستعلام والاتجاهات.',
    category: 'salon',
    category_label: 'صالون / سبا نسائي (Google)',
    city: cityAr,
    region: 'المنطقة الشرقية',
    address_ar: p.formattedAddress ?? undefined,
    latitude: lat,
    longitude: lng,
    phone,
    average_rating: p.rating ?? 0,
    total_reviews: p.userRatingCount ?? 0,
    total_bookings: 0,
    is_demo: false,
    source_type: 'provider_api',
    google_maps_uri: p.googleMapsUri ?? null,
    is_google_place: true,
    cover_image: coverFromPlace,
    images: coverFromPlace ? [coverFromPlace] : undefined,
  }
}

async function postSearchText(
  apiKey: string,
  textQuery: string,
  locationBias: { latitude: number; longitude: number },
  radius: number
): Promise<PlaceRow[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'ar',
      regionCode: 'SA',
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: locationBias.latitude, longitude: locationBias.longitude },
          radius,
        },
      },
    }),
  })
  if (!res.ok) {
    await res.text().catch(() => '')
    return []
  }
  const data = (await res.json()) as { places?: PlaceRow[] }
  return data.places ?? []
}

/**
 * جلب منشآت حقيقية من Google — **وضع نصّي فقط** (searchText):
 * لا نستخدم searchNearby على beauty_salon/hair_care لأنها تسحب حلاقة رجالية.
 * الاستعلامات تتضمن «نسائي / ladies» صراحةً + عدة مراكز بالخبر/الدمام لتعويض حد ~20 نتيجة/طلب.
 *
 * ملاحظة: لا يوجد «تحميل كامل» رسمي لكل الصالونات — Google يحدّ النتائج لكل طلب؛ التغطية تزداد بعدد الاستعلامات.
 */
export async function fetchGooglePlacesBeautySalons(apiKey: string): Promise<Business[]> {
  if (!apiKey.trim()) return []

  const merged = new Map<string, Business>()

  const addPlaces = (rows: PlaceRow[], cityAr: string, fromLadiesTextQuery: boolean) => {
    for (const p of rows) {
      const b = placeToBusiness(p, cityAr, apiKey, { fromLadiesTextQuery })
      if (b) merged.set(b.id, b)
    }
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /** مراكز داخل الخبر لتنويع نتائج البحث النصي */
  const khobarBiases: { latitude: number; longitude: number; radius: number }[] = [
    { latitude: 26.2172, longitude: 50.1971, radius: 11000 },
    { latitude: 26.302, longitude: 50.198, radius: 9500 },
    { latitude: 26.268, longitude: 50.225, radius: 9000 },
    { latitude: 26.245, longitude: 50.165, radius: 8500 },
  ]

  const khobarTextQueries = [
    'صالون نسائي الخبر',
    'مشغل نسائي الخبر',
    'سبا نسائي الخبر',
    'صالون تجميل نسائي الخبر',
    'مركز تجميل نسائي الخبر',
    'عيادة تجميل نسائي الخبر',
    'مكياج نسائي الخبر',
    'أظافر نسائي الخبر',
    'ladies beauty salon Al Khobar',
    'women only salon Khobar',
    'ladies spa Khobar',
    'nail salon women Khobar',
  ]

  for (const bias of khobarBiases) {
    for (const tq of khobarTextQueries) {
      const rows = await postSearchText(
        apiKey,
        tq,
        { latitude: bias.latitude, longitude: bias.longitude },
        bias.radius
      )
      addPlaces(rows, 'الخبر', true)
      await sleep(120)
    }
  }

  const dammamBiases: { latitude: number; longitude: number; radius: number }[] = [
    { latitude: 26.432, longitude: 50.088, radius: 12000 },
    { latitude: 26.395, longitude: 50.105, radius: 10000 },
  ]

  const dammamTextQueries = [
    'صالون نسائي الدمام',
    'مشغل نسائي الدمام',
    'سبا نسائي الدمام',
    'ladies beauty salon Dammam',
    'women only salon Dammam',
    'ladies spa Dammam',
  ]

  for (const bias of dammamBiases) {
    for (const tq of dammamTextQueries) {
      const rows = await postSearchText(
        apiKey,
        tq,
        { latitude: bias.latitude, longitude: bias.longitude },
        bias.radius
      )
      addPlaces(rows, 'الدمام', true)
      await sleep(120)
    }
  }

  return [...merged.values()]
}
