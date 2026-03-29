#!/usr/bin/env node
/**
 * Enrich missing salon images in key Eastern Province cities.
 *
 * Scope (default):
 * - الدمام، الخبر، الظهران، الأحساء (الهفوف)، الجبيل، القطيف، حفر الباطن، الخفجي، النعيرية
 *
 * Why:
 * - Many existing salons have placeholder/missing images.
 * - We use Google Places Text Search to find a real venue photo, then update DB.
 *
 * Env required:
 * - VITE_SUPABASE_URL | SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VITE_GOOGLE_MAPS_API_KEY | GOOGLE_MAPS_API_KEY
 *
 * Optional env:
 * - APPLY_UPDATES=1      // default dry-run (SQL/report only)
 * - MAX_ROWS=400         // how many candidate businesses to process
 * - MIN_SCORE=58         // match strictness (higher = safer)
 *
 * Outputs:
 * - supabase/seed/tmp_enrich_eastern_salon_images.sql
 * - reports/eastern-image-enrichment.json
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const EASTERN_CITY_ALIASES = {
  الدمام: ['الدمام'],
  الخبر: ['الخبر'],
  الظهران: ['الظهران'],
  الأحساء: ['الأحساء', 'الهفوف', 'الاحساء'],
  الجبيل: ['الجبيل'],
  القطيف: ['القطيف'],
  'حفر الباطن': ['حفر الباطن', 'حفرالباطن'],
  الخفجي: ['الخفجي'],
  النعيرية: ['النعيرية'],
}

const PLACEHOLDER_UNSPLASH_PATHS = new Set([
  '/photo-1560066984-138dadb4c035',
  '/photo-1540555700478-4be289fbec6d',
  '/photo-1570172619644-dfd03ed5d881',
  '/photo-1522337360788-8b13dee7a37e',
  '/photo-1516975080664-ed2fc6a32937e',
  '/photo-1487412947147-5cebf100ffc2',
  '/photo-1596755389378-c31d21fd1273',
  '/photo-1519699047748-de8e457a634e',
])

const FETCH_MAX_ATTEMPTS = 3
const FETCH_MIN_RETRY_DELAY_MS = 1500
const GLOBAL_API_DELAY_MS = 250
const MIN_TOKEN_OVERLAP = 0.45

const STOP_WORDS = new Set([
  'صالون',
  'الصالون',
  'نسائي',
  'للنساء',
  'نساء',
  'سيدات',
  'مشغل',
  'مركز',
  'تجميل',
  'beauty',
  'salon',
  'ladies',
  'women',
  'woman',
  'female',
  'spa',
  'clinic',
  'center',
])

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
      if (process.env[k] == null || process.env[k] === '') process.env[k] = v
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function retryWaitMs(failedAttemptNumber) {
  return Math.max(FETCH_MIN_RETRY_DELAY_MS, 900 * failedAttemptNumber)
}

async function safeFetch(url, init) {
  let lastError = null
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init)
      await sleep(GLOBAL_API_DELAY_MS)
      const retriable = !res.ok && (res.status === 429 || res.status >= 500)
      if (retriable && attempt < FETCH_MAX_ATTEMPTS) {
        await sleep(retryWaitMs(attempt))
        continue
      }
      if (retriable) return null
      return res
    } catch (e) {
      lastError = e
      if (attempt < FETCH_MAX_ATTEMPTS) await sleep(retryWaitMs(attempt))
    }
  }
  console.warn('[safeFetch] failed:', lastError instanceof Error ? lastError.message : String(lastError))
  await sleep(GLOBAL_API_DELAY_MS)
  return null
}

function norm(s) {
  return String(s ?? '')
    .replace(/\u0640/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normLow(s) {
  return norm(s).toLowerCase()
}

function cityBucket(cityRaw) {
  const city = norm(cityRaw)
  for (const [bucket, aliases] of Object.entries(EASTERN_CITY_ALIASES)) {
    for (const a of aliases) {
      const aa = norm(a)
      if (city === aa || city.includes(aa) || aa.includes(city)) return bucket
    }
  }
  return null
}

function sqlEsc(s) {
  return String(s ?? '').replace(/'/g, "''")
}

function candidateImageUrls(row) {
  const out = []
  if (typeof row.cover_image === 'string') out.push(row.cover_image)
  if (Array.isArray(row.images)) {
    for (const u of row.images) if (typeof u === 'string') out.push(u)
  }
  return out.map((x) => x.trim()).filter(Boolean)
}

function isSeedPlaceholderImage(url) {
  if (!url) return true
  try {
    const p = new URL(url)
    if (!p.hostname.includes('images.unsplash.com')) return false
    return [...PLACEHOLDER_UNSPLASH_PATHS].some((prefix) => p.pathname.startsWith(prefix))
  } catch {
    return false
  }
}

function hasRealImage(row) {
  if (typeof row.google_photo_resource === 'string' && row.google_photo_resource.trim()) return true
  const urls = candidateImageUrls(row)
  if (!urls.length) return false
  return urls.some((u) => !isSeedPlaceholderImage(u))
}

function tokenizeForMatch(name) {
  return normLow(name)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
}

function tokenOverlapScore(a, b) {
  const aa = new Set(tokenizeForMatch(a))
  const bb = new Set(tokenizeForMatch(b))
  if (aa.size === 0 || bb.size === 0) return 0
  let intersect = 0
  for (const t of aa) if (bb.has(t)) intersect++
  return intersect / Math.max(aa.size, bb.size)
}

function hasPhotoRef(r) {
  const ref = r?.photos?.[0]?.photo_reference
  return typeof ref === 'string' && ref.length > 0
}

function ratingNum(r) {
  return typeof r?.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0
}

function validTypeBoost(types) {
  const t = Array.isArray(types) ? types.join(' ').toLowerCase() : ''
  if (!t) return 0
  if (/beauty_salon|hair_care|spa|nail_salon/.test(t)) return 10
  if (/doctor|health/.test(t)) return 2
  return 0
}

function cityMatchBoost(address, cityBucketName) {
  if (!address || !cityBucketName) return 0
  const low = normLow(address)
  for (const alias of EASTERN_CITY_ALIASES[cityBucketName] ?? []) {
    if (low.includes(normLow(alias))) return 10
  }
  return 0
}

function placeScoreForBusiness(business, place, cityBucketName) {
  const nameScore = tokenOverlapScore(business.name_ar || business.name_en || '', place.name || '') * 100
  const photoScore = hasPhotoRef(place) ? 18 : 0
  const cityScore = cityMatchBoost(place.formatted_address || '', cityBucketName)
  const typeScore = validTypeBoost(place.types)
  const ratingScore = Math.min(12, Math.max(0, ratingNum(place) * 2))
  return {
    total: nameScore + photoScore + cityScore + typeScore + ratingScore,
    nameScore,
    nameOverlap: tokenOverlapScore(business.name_ar || business.name_en || '', place.name || ''),
    hasPhoto: hasPhotoRef(place),
  }
}

function photoUrl(apiKey, photoReference) {
  if (!photoReference || !apiKey) return null
  const ref = encodeURIComponent(photoReference)
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${ref}&key=${encodeURIComponent(apiKey)}`
}

async function textSearch(apiKey, query) {
  const p = new URLSearchParams()
  p.set('key', apiKey)
  p.set('query', query)
  p.set('language', 'ar')
  p.set('region', 'sa')
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${p.toString()}`
  const res = await safeFetch(url)
  if (!res) return []
  let data = null
  try {
    data = await res.json()
  } catch {
    return []
  }
  if (!data || (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) return []
  return Array.isArray(data.results) ? data.results : []
}

async function findBestPlaceForBusiness(apiKey, business, cityDisplayName) {
  const q1 = `${business.name_ar || business.name_en || ''} ${cityDisplayName} السعودية`
  const q2 = `${business.name_ar || business.name_en || ''} salon ${cityDisplayName}`
  const q3 = `${business.name_ar || business.name_en || ''} صالون نسائي ${cityDisplayName}`
  const results = [...(await textSearch(apiKey, q1)), ...(await textSearch(apiKey, q2)), ...(await textSearch(apiKey, q3))]
  if (!results.length) return null

  const byPlaceId = new Map()
  for (const r of results) {
    if (!r?.place_id) continue
    if (!byPlaceId.has(r.place_id)) byPlaceId.set(r.place_id, r)
  }

  let best = null
  let bestMeta = null
  const cityBucketName = cityBucket(business.city)
  for (const r of byPlaceId.values()) {
    const meta = placeScoreForBusiness(business, r, cityBucketName)
    if (!bestMeta || meta.total > bestMeta.total) {
      best = r
      bestMeta = meta
    }
  }
  if (!best || !bestMeta) return null
  return { place: best, meta: bestMeta }
}

async function main() {
  loadDotEnv()

  const apiKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const applyUpdates = process.env.APPLY_UPDATES === '1' || process.env.APPLY_UPDATES === 'true'
  const maxRows = Math.max(1, Number.parseInt(process.env.MAX_ROWS || '400', 10) || 400)
  const minScore = Math.max(1, Number.parseFloat(process.env.MIN_SCORE || '58') || 58)

  if (!apiKey || !url || !serviceKey) {
    console.error(
      'Missing env: VITE_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY), VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY'
    )
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('businesses')
    .select(
      'id,name_ar,name_en,city,region,category,category_value,cover_image,images,google_place_id,google_photo_resource,is_active,is_demo'
    )
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(5000)
  if (error) {
    console.error('[enrich] fetch failed:', error.message)
    process.exit(1)
  }

  const easternBuckets = new Set(Object.keys(EASTERN_CITY_ALIASES))
  const rows = (data ?? [])
    .filter((r) => easternBuckets.has(cityBucket(r.city) || ''))
    .filter((r) => {
      const cv = normLow(r.category_value)
      const cat = normLow(r.category)
      return cv === 'salon' || cat === 'salon' || cat === 'beauty_salon'
    })
    .filter((r) => !hasRealImage(r))
    .slice(0, maxRows)

  console.log('[enrich] candidate rows:', rows.length)
  console.log('[enrich] mode:', applyUpdates ? 'APPLY_UPDATES=1 (write to DB)' : 'dry-run (SQL/report only)')

  const updates = []
  const review = []

  for (const r of rows) {
    const cityDisplayName = cityBucket(r.city) || r.city || 'المنطقة الشرقية'
    const hit = await findBestPlaceForBusiness(apiKey, r, cityDisplayName)
    if (!hit) {
      review.push({
        id: r.id,
        city: r.city,
        name_ar: r.name_ar,
        status: 'no_match',
      })
      continue
    }

    const { place, meta } = hit
    const overlapOk = meta.nameOverlap >= MIN_TOKEN_OVERLAP
    const scoreOk = meta.total >= minScore
    const photoRef = place?.photos?.[0]?.photo_reference || null
    const photoRefOk = typeof photoRef === 'string' && photoRef.length > 0
    const accepted = Boolean(overlapOk && scoreOk && photoRefOk)

    review.push({
      id: r.id,
      city: r.city,
      name_ar: r.name_ar,
      status: accepted ? 'accepted' : 'rejected',
      score: Number(meta.total.toFixed(2)),
      overlap: Number(meta.nameOverlap.toFixed(3)),
      matched_name: place.name || null,
      matched_address: place.formatted_address || null,
      place_id: place.place_id || null,
      has_photo: !!photoRef,
    })

    if (!accepted) continue

    const photo = photoUrl(apiKey, photoRef)
    if (!photo) continue

    updates.push({
      id: r.id,
      google_place_id: place.place_id,
      google_photo_resource: photoRef,
      cover_image: photo,
      images: [photo],
    })
  }

  const reportDir = join(root, 'reports')
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, 'eastern-image-enrichment.json')
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        candidates: rows.length,
        accepted_updates: updates.length,
        rejected_or_no_match: review.length - updates.length,
        min_score: minScore,
        min_overlap: MIN_TOKEN_OVERLAP,
        review,
      },
      null,
      2
    ),
    'utf8'
  )

  const seedDir = join(root, 'supabase', 'seed')
  mkdirSync(seedDir, { recursive: true })
  const sqlPath = join(seedDir, 'tmp_enrich_eastern_salon_images.sql')
  const sql = []
  sql.push('-- Generated by scripts/enrich-eastern-salon-images.mjs')
  sql.push(`-- Generated at: ${new Date().toISOString()}`)
  sql.push(`-- Candidate rows scanned: ${rows.length}`)
  sql.push(`-- Accepted updates: ${updates.length}`)
  sql.push('BEGIN;')
  for (const u of updates) {
    const img = sqlEsc(u.cover_image)
    const gpr = sqlEsc(u.google_photo_resource)
    const gpid = sqlEsc(u.google_place_id)
    const bid = sqlEsc(u.id)
    sql.push(
      `UPDATE public.businesses SET google_place_id='${gpid}', google_photo_resource='${gpr}', cover_image='${img}', images=ARRAY['${img}']::text[] WHERE id='${bid}';`
    )
  }
  sql.push('COMMIT;')
  sql.push('')
  writeFileSync(sqlPath, sql.join('\n'), 'utf8')

  if (applyUpdates && updates.length > 0) {
    let ok = 0
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from('businesses')
        .update({
          google_place_id: u.google_place_id,
          google_photo_resource: u.google_photo_resource,
          cover_image: u.cover_image,
          images: u.images,
        })
        .eq('id', u.id)
      if (!upErr) ok += 1
    }
    console.log(`[enrich] DB updates applied: ${ok}/${updates.length}`)
  }

  console.log(`[enrich] report: ${reportPath}`)
  console.log(`[enrich] sql: ${sqlPath}`)
  console.log('[enrich] done')
}

main().catch((e) => {
  console.error('[enrich] fatal:', e?.message || e)
  process.exit(1)
})

