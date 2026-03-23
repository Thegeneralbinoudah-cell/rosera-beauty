#!/usr/bin/env node
/**
 * Repair businesses.latitude / businesses.longitude when null or not valid WGS84 numbers.
 *
 * Order:
 *   1) Google Place Details — legacy place_id (ChIJ…) or Places API v1 name (places/ChIJ…)
 *   2) Geocoding API — address_ar + city + region + Saudi Arabia
 *   3) Fallback — center of linked sa_cities row (city_id)
 *
 * Rows that still have no coords are logged as [INVALID] (not updated).
 *
 * Env: VITE_SUPABASE_URL | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      VITE_GOOGLE_MAPS_API_KEY | GOOGLE_MAPS_API_KEY
 *
 * Optional:
 *   FIX_COORDS_DRY_RUN=1  — log actions only, no DB updates
 *   FIX_COORDS_LIMIT=N    — process at most N invalid rows (testing)
 *
 * npm run fix:business-coords
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const SLEEP_MS = 350

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

function isValidPair(lat, lng) {
  const la = lat == null || lat === '' ? NaN : Number(lat)
  const ln = lng == null || lng === '' ? NaN : Number(lng)
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    Math.abs(la) <= 90 &&
    Math.abs(ln) <= 180
  )
}

function buildGeocodeQuery(row) {
  const parts = [row.address_ar, row.city, row.region, 'Saudi Arabia'].filter((x) => x && String(x).trim())
  return parts.join(', ')
}

/**
 * @param {string} apiKey
 * @param {string} placeId legacy ChIJ…
 */
async function placeDetailsLegacy(apiKey, placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry',
    key: apiKey,
  })
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  const res = await fetch(url)
  await sleep(SLEEP_MS)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK' || !data.result?.geometry?.location) return null
  const loc = data.result.geometry.location
  const lat = typeof loc.lat === 'number' ? loc.lat : Number(loc.lat)
  const lng = typeof loc.lng === 'number' ? loc.lng : Number(loc.lng)
  return isValidPair(lat, lng) ? { lat, lng } : null
}

/**
 * @param {string} apiKey
 * @param {string} resource e.g. places/ChIJ… or ChIJ…
 */
async function placeDetailsNew(apiKey, resource) {
  const id = resource.replace(/^places\//, '')
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'location',
    },
  })
  await sleep(SLEEP_MS)
  if (!res.ok) return null
  const data = await res.json()
  const lat = data.location?.latitude ?? data.location?.lat
  const lng = data.location?.longitude ?? data.location?.lng
  const la = typeof lat === 'number' ? lat : Number(lat)
  const ln = typeof lng === 'number' ? lng : Number(lng)
  return isValidPair(la, ln) ? { lat: la, lng: ln } : null
}

async function geocodeAddress(apiKey, address) {
  if (!address || !address.trim()) return null
  const params = new URLSearchParams({
    address: address.trim(),
    components: 'country:SA',
    region: 'sa',
    key: apiKey,
  })
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  const res = await fetch(url)
  await sleep(SLEEP_MS)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null
  const loc = data.results[0].geometry.location
  const lat = typeof loc.lat === 'number' ? loc.lat : Number(loc.lat)
  const lng = typeof loc.lng === 'number' ? loc.lng : Number(loc.lng)
  return isValidPair(lat, lng) ? { lat, lng } : null
}

async function main() {
  const apiKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const dryRun = process.env.FIX_COORDS_DRY_RUN === '1' || process.env.FIX_COORDS_DRY_RUN === 'true'
  const limitRaw = process.env.FIX_COORDS_LIMIT
  const maxRows =
    limitRaw != null && String(limitRaw).trim() !== ''
      ? Math.max(1, parseInt(String(limitRaw), 10) || 1)
      : Infinity

  if (!apiKey || !url || !serviceKey) {
    console.error(
      'Missing env: VITE_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY), VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const cityCache = new Map()

  async function cityCenterFromId(cityId) {
    if (!cityId) return null
    if (cityCache.has(cityId)) return cityCache.get(cityId)
    const { data, error } = await supabase.from('sa_cities').select('latitude, longitude').eq('id', cityId).maybeSingle()
    if (error || !data) {
      cityCache.set(cityId, null)
      return null
    }
    const la = Number(data.latitude)
    const ln = Number(data.longitude)
    const v = isValidPair(la, ln) ? { lat: la, lng: ln } : null
    cityCache.set(cityId, v)
    return v
  }

  const pageSize = 500
  let from = 0
  /** @type {any[]} */
  const all = []
  for (;;) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name_ar, google_place_id, address_ar, city, region, latitude, longitude, city_id')
      .eq('is_active', true)
      .eq('is_demo', false)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[fix-coords] fetch failed', error.message)
      process.exit(1)
    }
    if (!data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  const invalid = all.filter((r) => !isValidPair(r.latitude, r.longitude))
  console.log(`[fix-coords] loaded ${all.length} active businesses; invalid coordinates: ${invalid.length}`)
  if (invalid.length === 0) {
    console.log('[fix-coords] nothing to do.')
    return
  }

  let updated = 0
  let skippedLimit = 0
  let fromPlace = 0
  let fromGeocode = 0
  let fromCity = 0
  let stillInvalid = 0
  let attempted = 0

  for (const row of invalid) {
    if (maxRows !== Infinity && attempted >= maxRows) {
      skippedLimit += 1
      continue
    }
    attempted += 1

    let source = ''
    let coords = null

    const gid = (row.google_place_id || '').trim()
    if (gid) {
      if (gid.startsWith('places/')) {
        coords = await placeDetailsNew(apiKey, gid)
      } else {
        coords = await placeDetailsLegacy(apiKey, gid)
        if (!coords) coords = await placeDetailsNew(apiKey, `places/${gid}`)
      }
      if (coords) source = 'place_details'
    }

    if (!coords) {
      const q = buildGeocodeQuery(row)
      if (q.length > 8) {
        coords = await geocodeAddress(apiKey, q)
        if (coords) source = 'geocode'
      }
    }

    if (!coords && row.city_id) {
      coords = await cityCenterFromId(row.city_id)
      if (coords) source = 'sa_cities_center'
    }

    if (!coords) {
      stillInvalid += 1
      console.warn(
        `[INVALID] id=${row.id} name=${(row.name_ar || '').slice(0, 60)} google_place_id=${gid || '—'} address=${(row.address_ar || '').slice(0, 40)}`
      )
      continue
    }

    const la = Number(coords.lat)
    const ln = Number(coords.lng)
    if (dryRun) {
      console.log(`[DRY_RUN] would update ${row.id} via ${source} → ${la}, ${ln}`)
      updated += 1
      if (source === 'place_details') fromPlace += 1
      else if (source === 'geocode') fromGeocode += 1
      else if (source === 'sa_cities_center') fromCity += 1
      continue
    }

    const { error: upErr } = await supabase.from('businesses').update({ latitude: la, longitude: ln }).eq('id', row.id)
    if (upErr) {
      console.warn(`[fix-coords] update failed ${row.id}`, upErr.message)
      stillInvalid += 1
      continue
    }
    updated += 1
    if (source === 'place_details') fromPlace += 1
    else if (source === 'geocode') fromGeocode += 1
    else if (source === 'sa_cities_center') fromCity += 1
    console.log(`[fix-coords] updated ${row.id} (${source}) → ${la}, ${ln}`)
  }

  console.log(
    `[fix-coords] done. updated=${updated} (place=${fromPlace}, geocode=${fromGeocode}, city=${fromCity}), still_invalid=${stillInvalid}, skipped_limit=${skippedLimit}, dry_run=${dryRun}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
