#!/usr/bin/env node
/**
 * Eastern Province (SA) — Google Places Text Search (Legacy API), women-oriented beauty only.
 *
 * Env: VITE_SUPABASE_URL | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_GOOGLE_MAPS_API_KEY | GOOGLE_MAPS_API_KEY
 *
 * npm run seed:eastern-places
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const REGION_AR = 'المنطقة الشرقية'
const MAX_PER_CITY = 150
const MIN_PER_CITY_TARGET = 100
const PAGES_PER_QUERY = 3
const SLEEP_PAGE_MS = 2300
const SLEEP_QUERY_MS = 280

const CATEGORY_LABEL_AR = {
  hair: 'تصفيف وعناية بالشعر',
  laser: 'ليزر وإزالة شعر',
  nails: 'أظافر ومناكير',
  spa: 'سبا',
  massage: 'مساج وتدليك',
  makeup: 'مكياج',
  lashes: 'رموش',
  skincare: 'عناية بالبشرة',
  clinics: 'عيادة / عناية طبية',
}

/** displayCity = DB `city`, searchQueries = strings appended to templates */
const EASTERN_CITIES = [
  {
    displayCity: 'الدمام',
    searchQueries: ['الدمام'],
    centers: [
      { lat: 26.4207, lng: 50.0888, radius: 10000 },
      { lat: 26.392, lng: 50.064, radius: 9000 },
      { lat: 26.448, lng: 50.132, radius: 8500 },
      { lat: 26.36, lng: 50.15, radius: 11000 },
    ],
  },
  {
    displayCity: 'الخبر',
    searchQueries: ['الخبر'],
    centers: [
      { lat: 26.2794, lng: 50.208, radius: 9500 },
      { lat: 26.298, lng: 50.218, radius: 8000 },
      { lat: 26.255, lng: 50.192, radius: 10000 },
      { lat: 26.31, lng: 50.165, radius: 9000 },
    ],
  },
  {
    displayCity: 'الظهران',
    searchQueries: ['الظهران'],
    centers: [
      { lat: 26.2928, lng: 50.1136, radius: 8000 },
      { lat: 26.276, lng: 50.096, radius: 7000 },
      { lat: 26.308, lng: 50.128, radius: 9000 },
    ],
  },
  {
    displayCity: 'الأحساء',
    searchQueries: ['الأحساء', 'الهفوف', 'المبرز'],
    centers: [
      { lat: 25.3647, lng: 49.5653, radius: 12000 },
      { lat: 25.421, lng: 49.59, radius: 10000 },
      { lat: 25.33, lng: 49.52, radius: 11000 },
      { lat: 25.45, lng: 49.62, radius: 9000 },
    ],
  },
  {
    displayCity: 'الجبيل',
    searchQueries: ['الجبيل'],
    centers: [
      { lat: 27.0193, lng: 49.6378, radius: 11000 },
      { lat: 26.99, lng: 49.66, radius: 9000 },
      { lat: 27.05, lng: 49.58, radius: 10000 },
    ],
  },
  {
    displayCity: 'القطيف',
    searchQueries: ['القطيف'],
    centers: [
      { lat: 26.5196, lng: 50.0115, radius: 10000 },
      { lat: 26.54, lng: 49.98, radius: 8500 },
      { lat: 26.5, lng: 50.04, radius: 9000 },
    ],
  },
  {
    displayCity: 'سيهات',
    searchQueries: ['سيهات'],
    centers: [
      { lat: 26.6867, lng: 49.9967, radius: 11000 },
      { lat: 26.66, lng: 49.97, radius: 9500 },
      { lat: 26.71, lng: 50.02, radius: 10000 },
    ],
  },
  {
    displayCity: 'حفر الباطن',
    searchQueries: ['حفر الباطن'],
    centers: [
      { lat: 28.4335, lng: 45.9601, radius: 12000 },
      { lat: 28.4, lng: 45.92, radius: 10000 },
      { lat: 28.47, lng: 46.02, radius: 10000 },
    ],
  },
  {
    displayCity: 'الخفجي',
    searchQueries: ['الخفجي'],
    centers: [
      { lat: 28.4392, lng: 48.4913, radius: 11000 },
      { lat: 28.41, lng: 48.52, radius: 9000 },
      { lat: 28.47, lng: 48.45, radius: 10000 },
    ],
  },
  {
    displayCity: 'رأس تنورة',
    searchQueries: ['رأس تنورة'],
    centers: [
      { lat: 26.7062, lng: 50.0614, radius: 10000 },
      { lat: 26.68, lng: 50.09, radius: 9000 },
      { lat: 26.73, lng: 50.02, radius: 11000 },
    ],
  },
  {
    displayCity: 'بقيق',
    searchQueries: ['بقيق'],
    centers: [
      { lat: 25.9334, lng: 49.6686, radius: 12000 },
      { lat: 25.9, lng: 49.64, radius: 10000 },
      { lat: 25.97, lng: 49.71, radius: 10000 },
    ],
  },
  {
    displayCity: 'النعيرية',
    searchQueries: ['النعيرية'],
    centers: [
      { lat: 27.4695, lng: 48.4884, radius: 12000 },
      { lat: 27.44, lng: 48.45, radius: 10000 },
      { lat: 27.5, lng: 48.52, radius: 10000 },
    ],
  },
  {
    displayCity: 'قرية العليا',
    searchQueries: ['قرية العليا'],
    centers: [
      { lat: 27.5114, lng: 48.5234, radius: 12000 },
      { lat: 27.48, lng: 48.5, radius: 10000 },
      { lat: 27.54, lng: 48.56, radius: 10000 },
    ],
  },
  {
    displayCity: 'العديد',
    searchQueries: ['العديد'],
    centers: [
      { lat: 28.924, lng: 47.914, radius: 12000 },
      { lat: 28.89, lng: 47.88, radius: 10000 },
      { lat: 28.96, lng: 47.95, radius: 10000 },
    ],
  },
]

const QUERY_TEMPLATES = (cityToken) => [
  `صالون نسائي ${cityToken}`,
  `سبا نسائي ${cityToken}`,
  `عناية بالبشرة ${cityToken}`,
  `مساج نسائي ${cityToken}`,
]

function loadDotEnv() {
  const paths = [
    join(root, '.env.local'),
    join(root, '.env'),
    join(root, '..', '.env.local'),
    join(root, '..', '.env'),
    join(root, '.secrets.env'),
    join(root, '..', '.secrets.env'),
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
    const txt = readFileSync(p, 'utf8')
    for (let line of txt.split('\n')) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 1) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v
    }
  }
}

loadDotEnv()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function strictReject(name, address) {
  const ar = `${name || ''} ${address || ''}`
  const low = ar.toLowerCase()
  if (/حلاق|رجالي|للرجال|رجال\s*فقط|حلاقة\s*رجال/i.test(ar)) return true
  if (/\bbarber\b|\bbarbershop\b|\bbarbers\b/i.test(low)) return true
  if (/\bgents\b|\bgent'?s\b|\bmens\b|\bmen'?s\b|\bfor\s+men\b|\bmale\s+only\b/i.test(low)) return true
  if (/\bmen\b/.test(low) && !/women|ladies|نسائي|نساء|سيدات|female|lady|womens/i.test(low)) return true
  return false
}

function strictAccept(name, address) {
  const ar = `${name || ''} ${address || ''}`
  const low = ar.toLowerCase()
  if (/نسائي|للنساء|نساء|للسيدات|سيدات|مشغل\s*نسائي|صالون\s*نسائي|نساء\s*فقط/i.test(ar)) return true
  if (/\bladies\b|\blady\b|\bwomen\b|\bwomens\b|\bfemale\b|\bgirls\b/i.test(low)) return true
  if (/\bfamily\b/i.test(low) && /spa|salon|beauty|تجميل|سبا|صالون|مشغل|مركز|nail/i.test(low)) return true
  return false
}

function implicitWomenBeauty(name, types) {
  const n = (name || '').toLowerCase()
  const t = (types || []).join(' ').toLowerCase()
  if (/رجال|رجالي|حلاق|barber|gents|men'?s/i.test(n)) return false
  const okTypes = ['beauty_salon', 'spa', 'hair_care', 'nail_salon', 'cosmetics_store']
  if (okTypes.some((x) => t.includes(x))) return true
  if (/مشغل|مركز\s*تجميل|سبا|صالون\s*تجميل|nail|lashes|lash|مكياج|ليزر|عيادة\s*جلدية/i.test(n)) return true
  return false
}

function passesWomenOnlyFilter(name, address, types) {
  if (strictReject(name, address)) return false
  if (strictAccept(name, address)) return true
  return implicitWomenBeauty(name, types)
}

function classifyCategory(name, address, types) {
  const ar = `${name || ''} ${address || ''}`
  const blob = ar.toLowerCase()
  const t = (types || []).join(' ').toLowerCase()

  const scores = {
    hair: 0,
    laser: 0,
    nails: 0,
    spa: 0,
    massage: 0,
    makeup: 0,
    lashes: 0,
    skincare: 0,
    clinics: 0,
  }

  if (/ليزر|إزالة\s*الشعر|laser/i.test(ar) || /laser/.test(blob)) scores.laser += 8
  if (/أظافر|مناكير|بديكير|nail|manicure|pedicure/i.test(blob) || t.includes('nail_salon')) scores.nails += 8
  if (/رموش|lash|eyelash|extension/i.test(blob)) scores.lashes += 8
  if (/مساج|تدليك|massage/i.test(ar) || t.includes('massage')) scores.massage += 6
  if (/سبا|حمام\s*مغربي|استرخاء|hammam/i.test(ar) || t.includes('spa')) scores.spa += 6
  if (/مكياج|ميكب|makeup/i.test(blob)) scores.makeup += 6
  if (/بشرة|فيشال|facial|تنظيف\s*البشرة|skincare|peel/i.test(blob)) scores.skincare += 6
  if (/عيادة|جلدية|نساء\s*وولادة|ولادة|تجميل\s*طبي|dermatolog|skin\s*clinic/i.test(ar) || t.includes('doctor') || t.includes('hospital'))
    scores.clinics += 7
  if (/صالون\s*شعر|قص\s*شعر|صبغة|صبغ|hair\s*salon|hair\s*care/i.test(blob) || t.includes('hair_care')) scores.hair += 5
  if (t.includes('beauty_salon') && Math.max(...Object.values(scores)) < 3) scores.hair += 3

  let best = 'hair'
  let max = scores.hair
  for (const k of Object.keys(scores)) {
    if (scores[k] > max) {
      max = scores[k]
      best = k
    }
  }
  if (max === 0) {
    if (t.includes('spa')) return 'spa'
    if (t.includes('doctor') || t.includes('hospital')) return 'clinics'
    if (t.includes('beauty_salon') || t.includes('hair_care')) return 'hair'
    return 'hair'
  }
  return best
}

function placeScore(r) {
  const rating = typeof r.rating === 'number' ? r.rating : 0
  const c = typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0
  return rating * 1000 + Math.min(c, 9999)
}

function photoUrl(apiKey, photoReference) {
  if (!photoReference || !apiKey) return null
  const ref = encodeURIComponent(photoReference)
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${encodeURIComponent(apiKey)}`
}

function inEasternProvince(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  return lat >= 21 && lat <= 32 && lng >= 43 && lng <= 56
}

function looksSaudiAddress(addr) {
  if (!addr) return true
  const a = addr.toLowerCase()
  return /السعودية|saudi|ksa|eastern\s*province|الشرقية/i.test(a) || !/uae|dubai|kuwait|bahrain|qatar|oman/i.test(a)
}

async function textSearchPages(apiKey, query, center, maxPages) {
  const out = []
  let nextPageToken = null

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams()
    params.set('key', apiKey)

    if (nextPageToken) {
      params.set('pagetoken', nextPageToken)
    } else {
      params.set('query', query)
      params.set('language', 'ar')
      params.set('region', 'sa')
      if (center) {
        params.set('location', `${center.lat},${center.lng}`)
        params.set('radius', String(center.radius))
      }
    }

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status === 'INVALID_REQUEST' && nextPageToken) {
      await sleep(SLEEP_PAGE_MS)
      continue
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[textsearch]', query.slice(0, 40), data.status, data.error_message || '')
      break
    }

    out.push(...(data.results || []))
    nextPageToken = data.next_page_token
    if (!nextPageToken) break
    await sleep(SLEEP_PAGE_MS)
  }

  return out
}

async function resolveCityId(supabase, displayCity) {
  const { data, error } = await supabase.from('sa_cities').select('id').eq('name_ar', displayCity).maybeSingle()
  if (error) console.warn('[seed] city', displayCity, error.message)
  return data?.id ?? null
}

async function main() {
  const apiKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!apiKey || !url || !serviceKey) {
    console.error(
      'Missing env: VITE_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY), VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  let totalInserted = 0
  let totalUpdated = 0

  for (const cityCfg of EASTERN_CITIES) {
    const { displayCity, searchQueries, centers } = cityCfg
    const cityId = await resolveCityId(supabase, displayCity)

    const raw = []
    for (const center of centers) {
      for (const token of searchQueries) {
        for (const q of QUERY_TEMPLATES(token)) {
          const chunk = await textSearchPages(apiKey, q, center, PAGES_PER_QUERY)
          raw.push(...chunk)
          await sleep(SLEEP_QUERY_MS)
        }
      }
    }

    const totalCollected = raw.length
    const byId = new Map()
    for (const r of raw) {
      const pid = r.place_id
      if (!pid) continue
      const prev = byId.get(pid)
      if (!prev || placeScore(r) > placeScore(prev)) byId.set(pid, r)
    }

    const candidates = []
    for (const r of byId.values()) {
      const name = (r.name || '').trim()
      const addr = r.formatted_address || ''
      const types = r.types || []
      const lat = r.geometry?.location?.lat
      const lng = r.geometry?.location?.lng

      if (!name || typeof lat !== 'number' || typeof lng !== 'number') continue
      if (!inEasternProvince(lat, lng)) continue
      if (!looksSaudiAddress(addr)) continue
      if (!passesWomenOnlyFilter(name, addr, types)) continue

      candidates.push(r)
    }

    candidates.sort((a, b) => placeScore(b) - placeScore(a))
    const capped = candidates.slice(0, MAX_PER_CITY)

    console.log(`City: ${displayCity}`)
    console.log(`  Total collected: ${totalCollected}`)
    console.log(`  After filtering: ${capped.length}`)
    if (capped.length < MIN_PER_CITY_TARGET) {
      console.log(`  (below target ${MIN_PER_CITY_TARGET}–${MAX_PER_CITY} — Google quota/coverage varies)`)
    }

    let ins = 0
    let up = 0

    for (const r of capped) {
      const name = (r.name || '').trim()
      const addr = r.formatted_address || 'المنطقة الشرقية، السعودية'
      const lat = r.geometry.location.lat
      const lng = r.geometry.location.lng
      const pid = r.place_id
      const types = r.types || []
      const cat = classifyCategory(name, addr, types)
      const photoRef = r.photos?.[0]?.photo_reference ?? null
      const imageUrl = photoUrl(apiKey, photoRef)

      const row = {
        google_place_id: pid,
        google_photo_resource: photoRef,
        name_ar: name,
        name_en: name,
        description_ar:
          'منشأة فعلية من Google Maps (المنطقة الشرقية). راجعي المواعيد والخدمات مباشرة مع الصالون — روزيرا.',
        category: cat,
        category_label: `${CATEGORY_LABEL_AR[cat] || cat} (Google)`,
        city: displayCity,
        region: REGION_AR,
        city_id: cityId,
        address_ar: addr,
        latitude: lat,
        longitude: lng,
        phone: null,
        whatsapp: null,
        cover_image: imageUrl,
        images: imageUrl ? [imageUrl] : null,
        opening_hours: {},
        average_rating: typeof r.rating === 'number' ? r.rating : 0,
        total_reviews: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0,
        total_bookings: 0,
        price_range: 'moderate',
        is_active: true,
        is_verified: false,
        is_demo: false,
        source_type: 'provider_api',
      }

      const { data: existing } = await supabase.from('businesses').select('id').eq('google_place_id', pid).maybeSingle()

      if (existing?.id) {
        const { error: upErr } = await supabase.from('businesses').update(row).eq('id', existing.id)
        if (upErr) console.warn('[seed] update', pid, upErr.message)
        else up += 1
      } else {
        const id = crypto.randomUUID()
        const { error: inErr } = await supabase.from('businesses').insert({ ...row, id })
        if (inErr) console.warn('[seed] insert', name, inErr.message)
        else ins += 1
      }
    }

    totalInserted += ins
    totalUpdated += up
    console.log(`  Upserted: ${capped.length} (inserts + updates this city: ${ins} / ${up})`)
    console.log('')
  }

  console.log(`[seed:eastern] Done. Total inserts: ${totalInserted}, updates: ${totalUpdated}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
