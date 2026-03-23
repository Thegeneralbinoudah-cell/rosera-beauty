#!/usr/bin/env node
/**
 * Saudi Arabia — Google Places Text Search + Nearby Search, women-oriented beauty / clinics.
 * Geo-strict: text queries include city + region + country; address must mention KSA or the Arabic city.
 * Coverage: text search (paginated) + nearby search on a 5-point grid per city (beauty_salon, spa, hair_care).
 *
 * Env: VITE_SUPABASE_URL | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_GOOGLE_MAPS_API_KEY | GOOGLE_MAPS_API_KEY
 *
 * DB: migration 050_businesses_data_quality.sql (data_quality)
 *
 * npm run seed:gcc-clean
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Target minimum strict rows before skipping relaxed merge; upsert cap. */
const MIN_PER_CITY = 40
const MAX_PER_CITY = 80

const FALLBACK_MIN_RATING = 3.5
const HIGH_MIN_RATING = 4

const LOCATION_RADIUS_M = 20000

const RADIUS_EXPAND_MIN_M = 20000
const RADIUS_EXPAND_MAX_M = 50000
const RADIUS_EXPAND_FACTOR = 2

/** Google requires a short delay before pagetoken is valid; spec: 2s between pages. */
const NEXT_PAGE_TOKEN_DELAY_MS = 2000
const MAX_PAGES_PER_QUERY = 3

const SLEEP_QUERY_MS = 280

const FETCH_MAX_ATTEMPTS = 3
const FETCH_MIN_RETRY_DELAY_MS = 2000
const GLOBAL_API_DELAY_MS = 300

/** Grid offset from city center (degrees). */
const GRID_LAT_LNG_DELTA = 0.05

const NEARBY_PLACE_TYPES = ['beauty_salon', 'spa', 'hair_care']

function retryWaitMs(failedAttemptNumber) {
  return Math.max(FETCH_MIN_RETRY_DELAY_MS, 1000 * failedAttemptNumber)
}

async function safeFetch(url, init) {
  let lastError = null

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init)
      await sleep(GLOBAL_API_DELAY_MS)

      const retriable = !res.ok && (res.status >= 500 || res.status === 429)
      if (retriable && attempt < FETCH_MAX_ATTEMPTS) {
        console.warn(
          `[safeFetch] HTTP ${res.status} attempt ${attempt}/${FETCH_MAX_ATTEMPTS}`,
          url.length > 96 ? `${url.slice(0, 96)}…` : url
        )
        await sleep(retryWaitMs(attempt))
        continue
      }
      if (retriable) {
        console.warn(
          `[safeFetch] HTTP ${res.status} exhausted retries`,
          url.length > 96 ? `${url.slice(0, 96)}…` : url
        )
        return null
      }

      return res
    } catch (err) {
      lastError = err
      const cause = err && typeof err === 'object' && 'cause' in err ? err.cause : null
      const code =
        cause && typeof cause === 'object' && cause !== null && 'code' in cause
          ? String(cause.code)
          : err && typeof err === 'object' && err !== null && 'code' in err
            ? String(err.code)
            : ''
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[safeFetch] attempt ${attempt}/${FETCH_MAX_ATTEMPTS} ${msg}${code ? ` (${code})` : ''}`,
        url.length > 96 ? `${url.slice(0, 96)}…` : url
      )
      if (attempt < FETCH_MAX_ATTEMPTS) {
        await sleep(retryWaitMs(attempt))
      }
    }
  }

  console.warn(
    '[safeFetch] failed after retries:',
    lastError instanceof Error ? lastError.message : lastError,
    url.length > 96 ? `${url.slice(0, 96)}…` : url
  )
  await sleep(GLOBAL_API_DELAY_MS)
  return null
}

const PLACEHOLDER_COVER =
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80'

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

const REGION_AR_MAP = {
  'Eastern Province': 'المنطقة الشرقية',
  Riyadh: 'منطقة الرياض',
  Makkah: 'منطقة مكة المكرمة',
  Madinah: 'منطقة المدينة المنورة',
  Tabuk: 'منطقة تبوك',
  Qassim: 'منطقة القصيم',
  Asir: 'منطقة عسير',
  Hail: 'منطقة حائل',
  Najran: 'منطقة نجران',
}

function regionArFor(city) {
  return REGION_AR_MAP[city.region] ?? city.region
}

/**
 * @typedef {{ name: string, country: string, region: string, lat: number, lng: number }} CityRow
 */

/** @type {CityRow[]} */
const cities = [
  { name: 'الدمام', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.4207, lng: 50.0888 },
  { name: 'الخبر', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.2794, lng: 50.208 },
  { name: 'الظهران', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.2928, lng: 50.1136 },
  { name: 'الهفوف', country: 'Saudi Arabia', region: 'Eastern Province', lat: 25.3833, lng: 49.5877 },
  { name: 'المبرز', country: 'Saudi Arabia', region: 'Eastern Province', lat: 25.4075, lng: 49.5903 },
  { name: 'الجبيل', country: 'Saudi Arabia', region: 'Eastern Province', lat: 27.0193, lng: 49.6378 },
  { name: 'القطيف', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.5196, lng: 50.0115 },
  { name: 'سيهات', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.6867, lng: 49.9967 },
  { name: 'تاروت', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.5739, lng: 50.0045 },
  { name: 'صفوى', country: 'Saudi Arabia', region: 'Eastern Province', lat: 25.8072, lng: 49.6653 },
  { name: 'عنك', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.0917, lng: 49.985 },
  { name: 'حفر الباطن', country: 'Saudi Arabia', region: 'Eastern Province', lat: 28.4335, lng: 45.9601 },
  { name: 'الخفجي', country: 'Saudi Arabia', region: 'Eastern Province', lat: 28.4392, lng: 48.4913 },
  { name: 'بقيق', country: 'Saudi Arabia', region: 'Eastern Province', lat: 25.9334, lng: 49.6686 },
  { name: 'رأس تنورة', country: 'Saudi Arabia', region: 'Eastern Province', lat: 26.7062, lng: 50.0614 },
  { name: 'النعيرية', country: 'Saudi Arabia', region: 'Eastern Province', lat: 27.4695, lng: 48.4884 },
  { name: 'قرية العليا', country: 'Saudi Arabia', region: 'Eastern Province', lat: 27.5114, lng: 48.5234 },
  { name: 'سلوى', country: 'Saudi Arabia', region: 'Eastern Province', lat: 24.727, lng: 50.8055 },
  { name: 'القيصومة', country: 'Saudi Arabia', region: 'Eastern Province', lat: 28.3092, lng: 46.1269 },

  { name: 'الرياض', country: 'Saudi Arabia', region: 'Riyadh', lat: 24.7136, lng: 46.6753 },
  { name: 'جدة', country: 'Saudi Arabia', region: 'Makkah', lat: 21.4858, lng: 39.1925 },
  { name: 'مكة', country: 'Saudi Arabia', region: 'Makkah', lat: 21.3891, lng: 39.8579 },
  { name: 'المدينة', country: 'Saudi Arabia', region: 'Madinah', lat: 24.5247, lng: 39.5692 },
  { name: 'الطائف', country: 'Saudi Arabia', region: 'Makkah', lat: 21.2703, lng: 40.4158 },
  { name: 'تبوك', country: 'Saudi Arabia', region: 'Tabuk', lat: 28.3838, lng: 36.555 },
  { name: 'بريدة', country: 'Saudi Arabia', region: 'Qassim', lat: 26.326, lng: 43.9749 },
  { name: 'خميس مشيط', country: 'Saudi Arabia', region: 'Asir', lat: 18.3, lng: 42.7333 },
  { name: 'حائل', country: 'Saudi Arabia', region: 'Hail', lat: 27.5114, lng: 41.7208 },
  { name: 'نجران', country: 'Saudi Arabia', region: 'Najran', lat: 17.565, lng: 44.2289 },
  { name: 'أبها', country: 'Saudi Arabia', region: 'Asir', lat: 18.2164, lng: 42.5053 },
  { name: 'ينبع', country: 'Saudi Arabia', region: 'Madinah', lat: 24.0892, lng: 38.0618 },
]

const SEARCH_TERM_BASES = [
  'صالون نسائي',
  'سبا نسائي',
  'مشغل نسائي',
  'مركز تجميل نسائي',
  'عيادة ليزر',
  'عيادة جلدية',
  'مركز تجميل',
]

const FALLBACK_SEARCH_BASES = [
  'مركز عناية بالبشرة',
  'عيادة نسائية',
  'spa',
  'beauty salon',
]

function buildGeoStrictQuery(searchTerm, city) {
  return `${searchTerm} ${city.name} ${city.region} ${city.country}`
}

function primaryQueriesForCity(city) {
  return SEARCH_TERM_BASES.map((t) => buildGeoStrictQuery(t, city))
}

function fallbackQueriesForCity(city) {
  return FALLBACK_SEARCH_BASES.map((t) => buildGeoStrictQuery(t, city))
}

function radiusForCity(expanded) {
  return expanded
    ? Math.min(RADIUS_EXPAND_MAX_M, Math.max(RADIUS_EXPAND_MIN_M, LOCATION_RADIUS_M * RADIUS_EXPAND_FACTOR))
    : LOCATION_RADIUS_M
}

function centersForCity(city, expanded) {
  const radius = radiusForCity(expanded)
  return [{ lat: city.lat, lng: city.lng, radius }]
}

/** Five geo points: center, north, south, east, west. */
function geoGridPoints(city) {
  const { lat, lng } = city
  const d = GRID_LAT_LNG_DELTA
  return [
    { lat, lng },
    { lat: lat + d, lng },
    { lat: lat - d, lng },
    { lat, lng: lng + d },
    { lat, lng: lng - d },
  ]
}

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

function passesGeoStrictAddress(formattedAddress, cityNameAr) {
  const addr = (formattedAddress || '').trim()
  if (!addr) return false

  const low = addr.toLowerCase()
  const hasSaudi =
    /السعودية|المملكة\s*العربية\s*السعودية|kingdom\s+of\s+saudi|saudi\s+arabia|\bksa\b/i.test(addr)
  const hasCity = addr.includes(cityNameAr)

  if (!hasSaudi && !hasCity) return false

  const foreignHint =
    /\b(uae|dubai|abu\s*dhabi|sharjah|ajman|qatar|doha|kuwait|bahrain|manama|oman|muscat)\b/i.test(low)
  const saudiHint = /السعودية|saudi|ksa|kingdom\s+of\s+saudi/i.test(low)
  if (foreignHint && !saudiHint && !hasCity) return false

  return true
}

function inSaudiArabiaBounds(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  return lat >= 16 && lat <= 33 && lng >= 34 && lng <= 56
}

function strictReject(name, address) {
  const ar = `${name || ''} ${address || ''}`
  const low = ar.toLowerCase()
  if (/حلاق|حلاقة|رجالي|للرجال|رجال\s*فقط|حلاقة\s*رجال|صالون\s*رجال/i.test(ar)) return true
  if (/\bbarber\b|\bbarbershop\b|\bbarbers\b/i.test(low)) return true
  if (/\bgents\b|\bgent'?s\b|\bmens\b|\bmen'?s\b|\bfor\s+men\b|\bmale\s+only\b|\bmen\s+only\b/i.test(low)) return true
  if (/\bmen\b/.test(low) && !/women|ladies|نسائي|نساء|سيدات|female|lady|womens/i.test(low)) return true
  if (/\bرجال\b/.test(ar) && !/نسائي|نساء|سيدات|للنساء|women|ladies|female/i.test(ar)) return true
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

function implicitWomenBeautyClinic(name, types) {
  const n = (name || '').toLowerCase()
  const t = (types || []).join(' ').toLowerCase()
  if (/رجال|رجالي|حلاق|barber|gents|men'?s/i.test(n)) return false
  if (/ليزر|عيادة\s*جلدية|جلدية|dermatolog|skin\s*clinic|laser/i.test(n)) return true
  const okTypes = ['beauty_salon', 'spa', 'hair_care', 'nail_salon', 'cosmetics_store', 'doctor', 'health']
  if (okTypes.some((x) => t.includes(x))) return true
  if (/مشغل|مركز\s*تجميل|سبا|صالون\s*تجميل|nail|lashes|lash|مكياج/i.test(n)) return true
  return false
}

function passesWomenOnlyFilter(name, address, types) {
  if (strictReject(name, address)) return false
  if (strictAccept(name, address)) return true
  return implicitWomenBeautyClinic(name, types)
}

function hasPhotoRef(r) {
  const ref = r.photos?.[0]?.photo_reference
  return typeof ref === 'string' && ref.length > 0
}

function ratingNum(r) {
  return typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : null
}

function passesStrictPipeline(r) {
  const rt = ratingNum(r)
  if (rt === null || rt <= 0) return false
  return hasPhotoRef(r)
}

function passesRelaxedPipeline(r) {
  const rt = ratingNum(r)
  return rt !== null && rt >= FALLBACK_MIN_RATING
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
  const rating = ratingNum(r) ?? 0
  const c = typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0
  return rating * 1000 + Math.min(c, 9999)
}

function photoUrl(apiKey, photoReference) {
  if (!photoReference || !apiKey) return null
  const ref = encodeURIComponent(photoReference)
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${encodeURIComponent(apiKey)}`
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
    const res = await safeFetch(url)
    if (!res) {
      console.warn('[textsearch] no response after retries', query.slice(0, 64))
      break
    }

    let data
    try {
      data = await res.json()
    } catch (err) {
      console.warn('[textsearch] JSON parse failed', query.slice(0, 64), err instanceof Error ? err.message : err)
      break
    }

    if (data.status === 'INVALID_REQUEST' && nextPageToken) {
      await sleep(NEXT_PAGE_TOKEN_DELAY_MS)
      continue
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[textsearch]', query.slice(0, 64), data.status, data.error_message || '')
      break
    }

    out.push(...(data.results || []))
    nextPageToken = data.next_page_token
    if (!nextPageToken) break
    await sleep(NEXT_PAGE_TOKEN_DELAY_MS)
  }

  return out
}

/**
 * Nearby Search (legacy): same pagination rules as text search (2s before pagetoken).
 */
async function nearbySearchPages(apiKey, lat, lng, radiusM, placeType, maxPages) {
  const out = []
  let nextPageToken = null

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams()
    params.set('key', apiKey)

    if (nextPageToken) {
      params.set('pagetoken', nextPageToken)
    } else {
      params.set('location', `${lat},${lng}`)
      params.set('radius', String(radiusM))
      params.set('type', placeType)
      params.set('language', 'ar')
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`
    const res = await safeFetch(url)
    if (!res) {
      console.warn('[nearby] no response after retries', placeType, lat.toFixed(4), lng.toFixed(4))
      break
    }

    let data
    try {
      data = await res.json()
    } catch (err) {
      console.warn('[nearby] JSON parse failed', placeType, err instanceof Error ? err.message : err)
      break
    }

    if (data.status === 'INVALID_REQUEST' && nextPageToken) {
      await sleep(NEXT_PAGE_TOKEN_DELAY_MS)
      continue
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[nearby]', placeType, data.status, data.error_message || '')
      break
    }

    out.push(...(data.results || []))
    nextPageToken = data.next_page_token
    if (!nextPageToken) break
    await sleep(NEXT_PAGE_TOKEN_DELAY_MS)
  }

  return out
}

async function fetchCityNearbyGridRaw(apiKey, city, expanded) {
  const raw = []
  const radiusM = radiusForCity(expanded)
  const points = geoGridPoints(city)

  for (const p of points) {
    for (const placeType of NEARBY_PLACE_TYPES) {
      const chunk = await nearbySearchPages(apiKey, p.lat, p.lng, radiusM, placeType, MAX_PAGES_PER_QUERY)
      raw.push(...chunk)
      await sleep(SLEEP_QUERY_MS)
    }
  }
  return raw
}

/**
 * Text search (center bias) + nearby grid; merged downstream by place_id.
 * @param {{ expanded: boolean, includeFallbackQueries: boolean }} opts
 */
async function fetchCityRaw(apiKey, city, opts) {
  const textRaw = await fetchCityTextSearchRaw(apiKey, city, opts.expanded, opts.includeFallbackQueries)
  const nearbyRaw = await fetchCityNearbyGridRaw(apiKey, city, opts.expanded)
  return { textRaw, nearbyRaw, merged: [...textRaw, ...nearbyRaw] }
}

async function fetchCityTextSearchRaw(apiKey, city, expanded, includeFallback) {
  const raw = []
  const centersUse = centersForCity(city, expanded)

  for (const center of centersUse) {
    const queries = [...primaryQueriesForCity(city)]
    if (includeFallback) queries.push(...fallbackQueriesForCity(city))

    for (const q of queries) {
      const chunk = await textSearchPages(apiKey, q, center, MAX_PAGES_PER_QUERY)
      raw.push(...chunk)
      await sleep(SLEEP_QUERY_MS)
    }
  }
  return raw
}

function mergeIntoById(byId, raw) {
  for (const r of raw) {
    const pid = r.place_id
    if (!pid) continue
    const prev = byId.get(pid)
    if (!prev || placeScore(r) > placeScore(prev)) byId.set(pid, r)
  }
}

function filterBase(r, city) {
  const name = (r.name || '').trim()
  const addr = r.formatted_address || ''
  const types = r.types || []
  const lat = r.geometry?.location?.lat
  const lng = r.geometry?.location?.lng
  if (!name || typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!inSaudiArabiaBounds(lat, lng)) return null
  if (!passesGeoStrictAddress(addr, city.name)) return null
  if (!passesWomenOnlyFilter(name, addr, types)) return null
  return { name, addr, types, lat, lng }
}

function collectStrictCandidates(byId, city) {
  const out = []
  for (const r of byId.values()) {
    if (!filterBase(r, city)) continue
    if (!passesStrictPipeline(r)) continue
    out.push(r)
  }
  out.sort((a, b) => placeScore(b) - placeScore(a))
  return out
}

function collectRelaxedOnlyCandidates(byId, strictIds, city) {
  const out = []
  for (const r of byId.values()) {
    const pid = r.place_id
    if (!pid || strictIds.has(pid)) continue
    if (!filterBase(r, city)) continue
    if (!passesRelaxedPipeline(r)) continue
    out.push(r)
  }
  out.sort((a, b) => placeScore(b) - placeScore(a))
  return out
}

function dataQualityFor(r, strictEligible) {
  if (!strictEligible) return 'medium'
  const rt = ratingNum(r)
  if (hasPhotoRef(r) && rt !== null && rt > HIGH_MIN_RATING) return 'high'
  return 'medium'
}

function buildFinalList(strictList, relaxedList) {
  const strictIds = new Set(strictList.map((r) => r.place_id))
  const merged = []

  for (const r of strictList) {
    merged.push({ r, strictEligible: true })
  }
  for (const r of relaxedList) {
    if (strictIds.has(r.place_id)) continue
    merged.push({ r, strictEligible: false })
  }

  return merged.slice(0, MAX_PER_CITY)
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

  const placeIdHandledThisRun = new Set()

  let totalInserted = 0
  let totalUpdated = 0
  let totalSkippedCrossCity = 0
  let totalSkippedDedupeRun = 0
  let citiesUsedFallback = 0

  for (const city of cities) {
    const displayCity = city.name
    const regionAr = regionArFor(city)
    const cityId = await resolveCityId(supabase, displayCity)

    const byId = new Map()

    const primaryBundle = await fetchCityRaw(apiKey, city, { expanded: false, includeFallbackQueries: false })
    mergeIntoById(byId, primaryBundle.merged)

    let strictList = collectStrictCandidates(byId, city)
    let usedFallback = false
    let fallbackBundle = { textRaw: [], nearbyRaw: [], merged: [] }

    if (strictList.length < MIN_PER_CITY) {
      usedFallback = true
      citiesUsedFallback += 1
      console.log(`  ↳ fallback: relaxed filter + extra text queries + larger radius (text + nearby grid)`)
      fallbackBundle = await fetchCityRaw(apiKey, city, { expanded: true, includeFallbackQueries: true })
      mergeIntoById(byId, fallbackBundle.merged)
      strictList = collectStrictCandidates(byId, city)
    }

    const strictIds = new Set(strictList.map((r) => r.place_id))
    let finalItems
    let relaxedList = []
    if (strictList.length >= MIN_PER_CITY) {
      finalItems = strictList.slice(0, MAX_PER_CITY).map((r) => ({ r, strictEligible: true }))
    } else {
      relaxedList = collectRelaxedOnlyCandidates(byId, strictIds, city)
      finalItems = buildFinalList(strictList, relaxedList)
    }

    const textRowsPrimary = primaryBundle.textRaw.length
    const nearbyRowsPrimary = primaryBundle.nearbyRaw.length
    const textRowsFb = fallbackBundle.textRaw.length
    const nearbyRowsFb = fallbackBundle.nearbyRaw.length

    console.log(`City: ${displayCity} (${city.region}, ${city.country})`)
    const sampleQ = buildGeoStrictQuery('صالون نسائي', city)
    console.log(`  Sample text query: ${sampleQ.length > 100 ? `${sampleQ.slice(0, 100)}…` : sampleQ}`)
    console.log(
      `  Raw rows (pre-dedupe): text ${textRowsPrimary + textRowsFb} + nearby ${nearbyRowsPrimary + nearbyRowsFb} = ${textRowsPrimary + textRowsFb + nearbyRowsPrimary + nearbyRowsFb}`
    )
    if (usedFallback) {
      console.log(`    (primary text ${textRowsPrimary}, nearby ${nearbyRowsPrimary}; fallback text ${textRowsFb}, nearby ${nearbyRowsFb})`)
    }
    console.log(`  Unique place_id (merged): ${byId.size}`)
    console.log(`  Strict (photo + rating>0 + geo + women): ${strictList.length}`)
    if (relaxedList.length > 0) {
      console.log(`  Relaxed-only (rating≥${FALLBACK_MIN_RATING}): ${relaxedList.length}`)
    }
    console.log(`  Final upsert cap: ${finalItems.length} (max ${MAX_PER_CITY}, target ${MIN_PER_CITY}–${MAX_PER_CITY})`)
    if (finalItems.length < MIN_PER_CITY) {
      console.log(`  ⚠ Below ${MIN_PER_CITY} after fallback.`)
    }

    let ins = 0
    let up = 0
    let skipCross = 0
    let skipRun = 0

    for (const { r, strictEligible } of finalItems) {
      const name = (r.name || '').trim()
      const addr = r.formatted_address || `${displayCity}، المملكة العربية السعودية`
      const lat = r.geometry.location.lat
      const lng = r.geometry.location.lng
      const pid = r.place_id
      const types = r.types || []
      const cat = classifyCategory(name, addr, types)
      const photoRef = hasPhotoRef(r) ? r.photos[0].photo_reference : null
      const imageUrl = photoRef ? photoUrl(apiKey, photoRef) : PLACEHOLDER_COVER
      const dataQuality = dataQualityFor(r, strictEligible)

      if (placeIdHandledThisRun.has(pid)) {
        skipRun += 1
        continue
      }

      const row = {
        google_place_id: pid,
        google_photo_resource: photoRef,
        name_ar: name,
        name_en: name,
        description_ar:
          'منشأة فعلية من Google Maps (المملكة العربية السعودية). راجعي المواعيد والخدمات مباشرة مع المنشأة — روزيرا.',
        category: cat,
        category_label: `${CATEGORY_LABEL_AR[cat] || cat} (Google)`,
        city: displayCity,
        region: regionAr,
        city_id: cityId,
        address_ar: addr,
        latitude: lat,
        longitude: lng,
        phone: null,
        whatsapp: null,
        cover_image: imageUrl,
        images: imageUrl ? [imageUrl] : null,
        opening_hours: {},
        average_rating: ratingNum(r) ?? 0,
        total_reviews: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : 0,
        total_bookings: 0,
        price_range: 'moderate',
        is_active: true,
        is_verified: false,
        is_demo: false,
        source_type: 'provider_api',
        data_quality: dataQuality,
      }

      const { data: existing } = await supabase
        .from('businesses')
        .select('id, city, city_id')
        .eq('google_place_id', pid)
        .maybeSingle()

      if (existing?.id) {
        if (existing.city && existing.city !== displayCity) {
          skipCross += 1
          placeIdHandledThisRun.add(pid)
          continue
        }
        const patch = { ...row, city: displayCity, city_id: cityId ?? existing.city_id }
        const { error: upErr } = await supabase.from('businesses').update(patch).eq('id', existing.id)
        if (upErr) console.warn('[seed] update', pid, upErr.message)
        else {
          up += 1
          placeIdHandledThisRun.add(pid)
        }
      } else {
        const id = crypto.randomUUID()
        const { error: inErr } = await supabase.from('businesses').insert({ ...row, id })
        if (inErr) {
          if (/duplicate|unique/i.test(inErr.message)) {
            console.warn('[seed] insert duplicate google_place_id (race)', pid)
          } else if (/data_quality|column/i.test(inErr.message)) {
            console.error(
              '[seed] DB missing data_quality? Apply supabase/migrations/050_businesses_data_quality.sql —',
              inErr.message
            )
          } else {
            console.warn('[seed] insert', name, inErr.message)
          }
        } else {
          ins += 1
          placeIdHandledThisRun.add(pid)
        }
      }
    }

    totalInserted += ins
    totalUpdated += up
    totalSkippedCrossCity += skipCross
    totalSkippedDedupeRun += skipRun
    console.log(
      `  Upserted: ${ins + up} (inserts ${ins}, updates ${up}, skip same-run ${skipRun}, skip other-city ${skipCross})`
    )
    console.log('')
  }

  console.log(
    `[seed:gcc-clean] Done. inserts: ${totalInserted}, updates: ${totalUpdated}, skipped (other city): ${totalSkippedCrossCity}, skipped (dedupe run): ${totalSkippedDedupeRun}, cities using fallback: ${citiesUsedFallback}/${cities.length}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
