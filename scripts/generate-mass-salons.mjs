/**
 * Generates supabase/migrations/023_mass_rosera_salons.sql
 * — 3100+ beauty businesses with [RoseraSeed:v1] marker, services batch, Dhahran city.
 * Run: node scripts/generate-mass-salons.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SQL_OUT = join(ROOT, 'supabase/migrations/023_mass_rosera_salons.sql')
const TOTAL = 3100
const SEED_MARKER = '[RoseraSeed:v1]'
const EASTERN_REGION = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'
const DHAHRAN_ID = 'c8a01110-2b3d-4e9f-9a1c-0d44a4b0c001'
/** SQL fragment — works whether الظهران was seeded before or now */
const DHAHRAN_CITY_ID_SQL = `(SELECT c.id FROM public.sa_cities c WHERE c.region_id = '${EASTERN_REGION}'::uuid AND c.name_ar = 'الظهران' LIMIT 1)`

const CATEGORIES = ['صالون نسائي', 'سبا ومساج', 'مكياج', 'عناية بالبشرة']

const IMG_POOL = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80',
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=800&q=80',
  'https://images.unsplash.com/photo-1562322140-8ee00cf35a9a?w=800&q=80',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  'https://images.unsplash.com/photo-1560869713-da86aeead2a4?w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&q=80',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=800&q=80&sat=-20',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1512290923902-8a9f1325c77f?w=800&q=80',
  'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&q=80',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=800&q=80',
]

const PREFIX = ['صالون', 'مركز', 'مؤسسة', 'صالون وسبا', 'بيت', 'دار', 'أكاديمية', 'استوديو']
const CORE = [
  'لمسات روز', 'ورد الجوري', 'الأناقة', 'نور الشرق', 'الأميرة', 'الدرة', 'اللؤلؤة', 'الزهور',
  'رونق', 'أصالة', 'سحر الليل', 'لمسة فنان', 'تألق', 'إشراق', 'النجوم', 'القمر', 'الياسمين',
  'دانة الخليج', 'نسيم البحر', 'جمالك', 'بشرتك', 'نعومتك', 'لمسة حنان', 'تاج الملكة',
  'روضة الزهور', 'واحة الجمال', 'سر الأنوثة', 'بريق العيون', 'شعر الحرير', 'إطلالة',
]

const DISTRICTS_BY_CITY = {
  الخبر: ['حي الشاطئ', 'حي الثقبة', 'حي الراكة', 'حي الحزام الذهبي', 'حي الجسر'],
  الدمام: ['حي الفيصلية', 'حي الشعلة', 'حي النور', 'حي الضباب', 'حي المحمدية'],
  الظهران: ['حي الدوحة الجنوبية', 'حي قصر الخليج', 'حي الجامعة', 'حي الشفاء', 'حي العليا'],
  القطيف: ['القطيف المركزية', 'حي الجزيرة', 'حي المدينة', 'حي البحاري', 'حي الربيعية'],
  الجبيل: ['حي الفناتير', 'حي الجبيل البلد', 'حي ينبع النخل', 'حي الدانة', 'حي الشاطئ'],
  الأحساء: ['حي المحاسن', 'حي المنيزلة', 'حي الهفوف', 'حي المبرز', 'حي الرميلة'],
  الرياض: ['حي النخيل', 'حي الملقا', 'حي العليا', 'حي الياسمين', 'حي قرطبة'],
  جدة: ['حي الزهراء', 'حي الروضة', 'حي الصفا', 'حي الحمراء', 'حي أبحر'],
  'مكة المكرمة': ['حي العزيزية', 'حي الزاهر', 'حي الشوقية', 'حي الكعكية', 'حي التنعيم'],
  الطائف: ['حي الشفا', 'حي الحوية', 'حي العقيق', 'حي السلامة', 'حي القيم'],
  'المدينة المنورة': ['حي قباء', 'حي العيون', 'حي السكب', 'حي شوران', 'حي بني حارثة'],
  أبها: ['حي الموظفين', 'حي النسيم', 'حي المفتاحة', 'حي القابل', 'حي السد'],
  جازان: ['حي الكورنيش', 'حي الشاطئ', 'حي الروضة', 'حي السويس', 'حي النهضة'],
  نجران: ['حي الملك فهد', 'حي الفهد', 'حي الصناعية', 'حي الفيصلية', 'حي المطار'],
  تبوك: ['حي المروج', 'حي العليا', 'حي المنتزه', 'حي الراجحي', 'حي الفيصلية'],
  حائل: ['حي الجامعة', 'حي السمراء', 'حي المنار', 'حي المنتزه', 'حي السلام'],
  عرعر: ['حي المطار', 'حي العزيزية', 'حي الروضة', 'حي الصناعية', 'حي الفيصلية'],
  'سكاكا': ['حي المطار', 'حي الناصرية', 'حي الروضة', 'حي المصيف', 'حي الفيصلية'],
}

const GENERIC_DISTRICTS = ['حي الملك فهد', 'حي النخيل', 'حي الروضة', 'حي الفيصلية', 'وسط البلد', 'حي العليا']

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function parseRegions(sql) {
  const i = sql.indexOf('INSERT INTO public.sa_regions')
  const j = sql.indexOf('INSERT INTO public.sa_cities', i)
  const block = sql.slice(i, j)
  const map = new Map()
  const re = /\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+)\)/g
  let m
  while ((m = re.exec(block)) !== null) {
    map.set(m[1], m[2])
  }
  return map
}

function parseCities(sql) {
  const i = sql.indexOf('INSERT INTO public.sa_cities')
  const j = sql.indexOf('INSERT INTO public.businesses', i)
  const block = sql.slice(i, j)
  const rows = []
  const re = /\('([0-9a-f-]{36})',\s*'([0-9a-f-]{36})',\s*'([^']+)',\s*([0-9.]+),\s*([0-9.]+)\)/g
  let m
  while ((m = re.exec(block)) !== null) {
    rows.push({
      id: m[1],
      region_id: m[2],
      name_ar: m[3],
      latitude: parseFloat(m[4]),
      longitude: parseFloat(m[5]),
    })
  }
  return rows
}

function hash32(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function main() {
  const sql404 = readFileSync(join(ROOT, 'supabase/migrations/004_seed_sa_full.sql'), 'utf8')
  const regionNames = parseRegions(sql404)
  let cities = parseCities(sql404)

  if (!cities.some((c) => c.name_ar === 'الظهران')) {
    cities.push({
      id: DHAHRAN_ID,
      region_id: EASTERN_REGION,
      name_ar: 'الظهران',
      latitude: 26.304,
      longitude: 50.103,
    })
  }

  const easternCityNames = new Set(
    cities.filter((c) => c.region_id === EASTERN_REGION).map((c) => c.name_ar)
  )
  const priorityEastern = ['الخبر', 'الدمام', 'الظهران', 'القطيف', 'الجبيل', 'الأحساء']
  const priorityCentral = ['الرياض']
  const priorityWest = ['جدة', 'مكة المكرمة', 'المدينة المنورة', 'الطائف']
  const prioritySouth = ['أبها', 'جازان', 'نجران', 'خميس مشيط', 'بيشة']
  const priorityNorth = ['تبوك', 'حائل', 'عرعر', 'سكاكا', 'رفحاء']

  function weight(c) {
    const n = c.name_ar
    if (priorityEastern.includes(n) && easternCityNames.has(n)) return 120
    if (priorityCentral.includes(n)) return 55
    if (priorityWest.includes(n)) return 45
    if (prioritySouth.includes(n)) return 28
    if (priorityNorth.includes(n)) return 22
    if (c.region_id === EASTERN_REGION) return 15
    return 4
  }

  const weights = cities.map((c) => weight(c))
  const sum = weights.reduce((a, b) => a + b, 0)

  function pickCity(idx) {
    let t = (hash32(`city${idx}`) % sum) + 1
    for (let i = 0; i < cities.length; i++) {
      t -= weights[i]
      if (t <= 0) return cities[i]
    }
    return cities[cities.length - 1]
  }

  function districtFor(cityName, idx) {
    const list = DISTRICTS_BY_CITY[cityName] || GENERIC_DISTRICTS
    return list[hash32(`dist${idx}${cityName}`) % list.length]
  }

  function phoneFor(idx) {
    const n = 10000000 + (hash32(`ph${idx}`) % 89999999)
    return `05${String(n).slice(0, 8)}`
  }

  function ratingFor(idx) {
    const r = 38 + (hash32(`rt${idx}`) % 12)
    return (r / 10).toFixed(1)
  }

  const opening =
    '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'

  const parts = []
  parts.push(`-- Rosera mass seed ${TOTAL} salons + default services (${SEED_MARKER})
-- Re-run safe: deletes prior seed batch first.

BEGIN;

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '${DHAHRAN_ID}'::uuid, '${EASTERN_REGION}'::uuid, 'الظهران', 26.304, 50.103
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = '${EASTERN_REGION}'::uuid AND c.name_ar = 'الظهران'
);

DELETE FROM public.services WHERE business_id IN (
  SELECT id FROM public.businesses WHERE position('${esc(SEED_MARKER)}' in description_ar) > 0
);
DELETE FROM public.businesses WHERE position('${esc(SEED_MARKER)}' in description_ar) > 0;

`)

  const batchSize = 200
  for (let b = 0; b < TOTAL; b += batchSize) {
    const chunk = []
    const end = Math.min(b + batchSize, TOTAL)
    for (let i = b; i < end; i++) {
      const city = pickCity(i)
      const regionAr = regionNames.get(city.region_id) || 'السعودية'
      const cat = CATEGORIES[hash32(`cat${i}`) % CATEGORIES.length]
      const prefix = PREFIX[hash32(`pre${i}`) % PREFIX.length]
      const core = CORE[hash32(`core${i}`) % CORE.length]
      const name = `${prefix} ${core} — ${city.name_ar}`
      const dist = districtFor(city.name_ar, i)
      const address = `${dist}، ${city.name_ar}`
      const latOff = ((hash32(`la${i}`) % 4000) - 2000) / 100000
      const lngOff = ((hash32(`ln${i}`) % 4000) - 2000) / 100000
      const lat = city.latitude + latOff
      const lng = city.longitude + lngOff
      const phone = phoneFor(i)
      const rating = ratingFor(i)
      const img = IMG_POOL[hash32(`img${i}`) % IMG_POOL.length]
      const cover = `${img}&sig=${i}`
      const id = randomUUID()
      const desc = `${name} — صالون ومركز تجميل في ${city.name_ar}. ${SEED_MARKER}`
      const reviews = 5 + (hash32(`rv${i}`) % 120)
      const bookings = 10 + (hash32(`bk${i}`) % 200)
      const imagesArr = `ARRAY['${esc(cover)}','${esc(img)}&sig=${i}b']`

      const cityIdSql = city.name_ar === 'الظهران' ? DHAHRAN_CITY_ID_SQL : `'${city.id}'::uuid`
      chunk.push(
        `('${id}'::uuid,${cityIdSql},'${esc(name)}','${esc(desc)}','salon','${esc(cat)}','${esc(city.name_ar)}','${esc(regionAr)}','${esc(address)}',${lat},${lng},'${phone}','${phone}','${esc(cover)}',${imagesArr},'${opening}'::jsonb,${rating}::numeric,${reviews},${bookings},'moderate',true,true,true,'imported')`
      )
    }
    parts.push(
      `INSERT INTO public.businesses (id,city_id,name_ar,description_ar,category,category_label,city,region,address_ar,latitude,longitude,phone,whatsapp,cover_image,images,opening_hours,average_rating,total_reviews,total_bookings,price_range,is_active,is_verified,is_demo,source_type) VALUES\n${chunk.join(',\n')};\n\n`
    )
  }

  parts.push(`INSERT INTO public.services (id, business_id, name_ar, category, price, duration_minutes, is_active, is_demo, source_type)
SELECT gen_random_uuid(), id, 'جلسة عناية وتجميل', 'care', 180.00, 60, true, true, 'imported'
FROM public.businesses WHERE position('${esc(SEED_MARKER)}' in description_ar) > 0;

COMMIT;
`)

  writeFileSync(SQL_OUT, parts.join(''), 'utf8')
  console.log('Wrote', SQL_OUT, 'rows ~', TOTAL, 'businesses + services')
}

main()
