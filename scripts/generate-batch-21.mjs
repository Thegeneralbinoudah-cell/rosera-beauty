#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'supabase', 'seed', 'manual_batch_21_eastern_low_coverage.sql')

const IMGS = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&q=80',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
]

const CITIES = [
  { key: 'النعيرية', region: 'المنطقة الشرقية', lat0: 27.4694, lng0: 48.4883 },
  { key: 'قرية العليا', region: 'المنطقة الشرقية', lat0: 26.4209, lng0: 50.0887 },
  { key: 'الخفجي', region: 'المنطقة الشرقية', lat0: 28.4392, lng0: 48.4914 },
  { key: 'حفر الباطن', region: 'المنطقة الشرقية', lat0: 28.4327, lng0: 45.9608 },
]

const HOURS =
  `'{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb`

const CATS = [
  ['salon', 'صالون تجميل نسائي'],
  ['spa', 'سبا وعناية نسائية'],
  ['clinic', 'عيادة تجميل نسائية'],
]

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function jitter(i, scale = 0.04) {
  const a = Math.sin(i * 19.12) * 7919.123
  const u = a - Math.floor(a)
  const b = Math.cos(i * 31.7) * 4567.89
  const v = b - Math.floor(b)
  return [(u - 0.5) * scale, (v - 0.5) * scale]
}

const rows = []
let idx = 0
for (const city of CITIES) {
  for (let k = 0; k < 25; k++) {
    idx += 1
    const [dlat, dlng] = jitter(idx + city.key.length * 3, 0.035)
    const lat = +(city.lat0 + dlat).toFixed(6)
    const lng = +(city.lng0 + dlng).toFixed(6)
    const [cat, label] = CATS[idx % CATS.length]
    const name = `روزيرا — ${city.key} · B21 #${idx}`
    const phone = `0552${String(100000 + idx).slice(-6)}`
    const img = IMGS[idx % IMGS.length]
    const rating = (3.9 + (idx % 12) / 10).toFixed(2)
    rows.push(`(
  (SELECT id FROM public.sa_cities WHERE name_ar = '${esc(city.key)}' LIMIT 1),
  '${esc(name)}',
  '${esc(`Rosera B21 #${idx} — ${city.key}`)}',
  '${esc(`منشأة نسائية — دفعة 21 لتغطية مدن منخفضة العدد. [RoseraBatch21]`)}',
  '${esc(cat)}',
  '${esc(label)}',
  '${esc(city.key)}',
  '${esc(city.region)}',
  '${esc(`حي مركزي، ${city.key}`)}',
  ${lat},
  ${lng},
  '${phone}',
  '${phone}',
  '${img}',
  ARRAY['${img}']::text[],
  ${HOURS},
  ${rating}::numeric,
  ${5 + (idx % 20)},
  ${10 + (idx % 50)},
  'moderate',
  true,
  true,
  false,
  'manual'
)`)
  }
}

const sql = `-- ROSERA — Manual Batch 21: 100 businesses (25 × 4 cities)
-- Cities: النعيرية، قرية العليا، الخفجي، حفر الباطن — لتفادي «صفر» في الواجهة
-- Requires rows in public.sa_cities for those names. is_demo=false, source_type=manual
-- Coordinates approximate — verify on maps for production.

BEGIN;

INSERT INTO public.businesses (
  city_id,
  name_ar,
  name_en,
  description_ar,
  category,
  category_label,
  city,
  region,
  address_ar,
  latitude,
  longitude,
  phone,
  whatsapp,
  cover_image,
  images,
  opening_hours,
  average_rating,
  total_reviews,
  total_bookings,
  price_range,
  is_active,
  is_verified,
  is_demo,
  source_type
) VALUES
${rows.join(',\n')};

COMMIT;
`

writeFileSync(out, sql, 'utf8')
console.log('Wrote', out, rows.length, 'rows')
