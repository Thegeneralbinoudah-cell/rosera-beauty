/**
 * Generates supabase/seed/manual_eastern_50_khobar_dammam.sql
 * 50 curated-style businesses (25 الخبر + 25 الدمام) — coordinates ~26.2, 50.1
 * Run: node scripts/generate-eastern-khobar-dammam-50.mjs
 */
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'supabase', 'seed', 'manual_eastern_50_khobar_dammam.sql')

const TAG = '[RoseraEastern50:v1]'
const REGION = 'المنطقة الشرقية'

const covers = [
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&q=80&auto=format&fit=crop',
]

const opening =
  `'{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb`

/** Deterministic pseudo-coords around anchor (spread ~8km) */
function coordKhobar(i) {
  const lat = 26.18 + (i % 11) * 0.012 + (i % 3) * 0.004
  const lng = 50.08 + (i % 13) * 0.009 + (i % 5) * 0.003
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}
function coordDammam(i) {
  const lat = 26.36 + (i % 10) * 0.011 + (i % 4) * 0.005
  const lng = 50.04 + (i % 12) * 0.008 + (i % 6) * 0.004
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

function phone(i) {
  const prefixes = ['053', '054', '055', '056', '058', '059']
  const pre = prefixes[i % prefixes.length]
  const tail = String(1000000 + (i * 7919 + 137) % 8999999).padStart(7, '0')
  return `${pre}${tail}`
}

const khobarNames = [
  ['صالون لمسة الشرق — الراكة', 'Lamsat Al Sharq Salon — Al Rakah', 'salon', 'صالون تجميل نسائي', 'حي الراكة، الخبر'],
  ['سبا فيروز — العقربية', 'Fairouz Spa — Al Aqrabiyah', 'spa', 'سبا ومساج', 'حي العقربية، الخبر'],
  ['عيادة ليزر بيور سكين — الثقبة', 'Pure Skin Laser Clinic — Al Thuqbah', 'clinic', 'ليزر وعناية', 'حي الثقبة، الخبر'],
  ['ستوديو مكياج دانة — الحزام الذهبي', 'Dana Makeup Studio — Golden Belt', 'salon', 'مكياج وتجميل', 'الحزام الذهبي، الخبر'],
  ['صالون شعر سيدرا — الجسر', 'Cedar Hair Salon — Al Jisr', 'salon', 'قص وتصفيف', 'حي الجسر، الخبر'],
  ['سبا نورم — الشاطئ', 'Noor Spa — Ash Shati', 'spa', 'سبا وعناية نسائية', 'حي الشاطئ، الخبر'],
  ['مركز أظافر توليب — الخبر الشمالية', 'Tulip Nails — North Khobar', 'salon', 'أظافر وبيديكير', 'الخبر الشمالية، الخبر'],
  ['عيادة جلدية نسائية — قرطبة', 'Women Dermatology — Qurtubah', 'clinic', 'جلدية وتجميل', 'حي قرطبة، الخبر'],
  ['صالون أميرة الخليج — اليرموك', 'Amirat Al Khaleej — Al Yarmouk', 'salon', 'صالون نسائي', 'حي اليرموك، الخبر'],
  ['سبا حمام مغربي — مدينة العمال', 'Moroccan Bath Spa — Workers City', 'spa', 'حمام مغربي', 'مدينة العمال، الخبر'],
  ['ستوديو حواجب وإطلالة — الروابي', 'Brows & Glow Studio — Ar Rawabi', 'salon', 'حواجب ورموش', 'حي الروابي، الخبر'],
  ['صالون دانة اللؤلؤ — الكورنيش', 'Dana Al Lulu — Corniche', 'salon', 'تجميل كامل', 'كورنيش الخبر، الخبر'],
  ['عيادة ليزر فيلا — العليا', 'Vela Laser — Al Olaya', 'clinic', 'ليزر وإزالة شعر', 'حي العليا، الخبر'],
  ['سبا أروما — الفيصلية', 'Aroma Spa — Al Faisaliyah', 'spa', 'مساج وزيوت', 'حي الفيصلية، الخبر'],
  ['صالون تجميل نسيم — الخبر الجنوبية', 'Naseem Beauty — South Khobar', 'salon', 'أناقة عصرية', 'الخبر الجنوبية، الخبر'],
  ['مركز عناية بشرة — الحزام', 'Skin Care Center — Al Hizam', 'clinic', 'عناية بالبشرة', 'حي الحزام، الخبر'],
  ['صالون شعر روز — الهدا', 'Rose Hair — Al Hada', 'salon', 'صبغات وعلاج', 'حي الهدا، الخبر'],
  ['سبا ومساج أرجان — الريان', 'Argan Spa — Ar Rayyan', 'spa', 'سبا مغربي', 'حي الريان، الخبر'],
  ['ستوديو مكياج عروس — الثقبة', 'Bridal Makeup Studio — Al Thuqbah', 'salon', 'مكياج عرائس', 'حي الثقبة، الخبر'],
  ['صالون إطلالة — العقربية', 'Itlalah Salon — Al Aqrabiyah', 'salon', 'صالون تجميل', 'حي العقربية، الخبر'],
  ['عيادة تجميل بوتيك — الراكة', 'Boutique Clinic — Al Rakah', 'clinic', 'حقن وبشرة', 'حي الراكة، الخبر'],
  ['سبا كريستال — الشاطئ', 'Crystal Spa — Ash Shati', 'spa', 'سبا فاخر', 'حي الشاطئ، الخبر'],
  ['صالون شعر أندلس — الخبر الشمالية', 'Andalus Hair — North Khobar', 'salon', 'تصفيف وإبداع', 'الخبر الشمالية، الخبر'],
  ['مركز عناية — مدينة العمال', 'Care Center — Workers City', 'clinic', 'عناية وليزر', 'مدينة العمال، الخبر'],
  ['صالون نسائي لمسة — الحزام الذهبي', 'Lamsa Ladies — Golden Belt', 'salon', 'مكياج وشعر', 'الحزام الذهبي، الخبر'],
]

const dammamNames = [
  ['صالون دانة الدمام — الفيصلية', 'Dana Dammam Salon — Al Faisaliyah', 'salon', 'صالون نسائي', 'حي الفيصلية، الدمام'],
  ['سبا واحة — الشاطئ الشرقي', 'Oasis Spa — East Coast', 'spa', 'مساج وسبا', 'الشاطئ الشرقي، الدمام'],
  ['عيادة ليزر بيور — الروضة', 'Pure Laser — Ar Rawdah', 'clinic', 'ليزر وإزالة شعر', 'حي الروضة، الدمام'],
  ['ستوديو مكياج لؤلؤ — الكورنيش', 'Pearl Makeup — Corniche', 'salon', 'مكياج سهرة', 'كورنيش الدمام، الدمام'],
  ['صالون شعر سيدرا — النور', 'Cedar Hair — An Nur', 'salon', 'قص وصبغ', 'حي النور، الدمام'],
  ['سبا نورم — المحمدية', 'Noor Spa — Al Muhammadiyah', 'spa', 'سبا ومساج', 'حي المحمدية، الدمام'],
  ['مركز أظافر توليب — الفيصلية', 'Tulip Nails — Al Faisaliyah', 'salon', 'أظافر', 'حي الفيصلية، الدمام'],
  ['عيادة جلدية نسائية — الضباب', 'Women Derma — Ad Dabab', 'clinic', 'جلدية', 'حي الضباب، الدمام'],
  ['صالون أميرة الخليج — الروضة', 'Amirat Al Khaleej — Ar Rawdah', 'salon', 'صالون تجميل', 'حي الروضة، الدمام'],
  ['سبا حمام مغربي — الشاطئ', 'Moroccan Bath — Ash Shati', 'spa', 'حمام مغربي', 'حي الشاطئ، الدمام'],
  ['ستوديو حواجب — النور', 'Brows Studio — An Nur', 'salon', 'حواجب ورموش', 'حي النور، الدمام'],
  ['صالون دانة اللؤلؤ — الكورنيش', 'Dana Al Lulu — Corniche', 'salon', 'تجميل', 'كورنيش الدمام، الدمام'],
  ['عيادة ليزر فيلا — العزيزية', 'Vela Laser — Al Aziziyah', 'clinic', 'ليزر', 'حي العزيزية، الدمام'],
  ['سبا أروما — الفيصلية', 'Aroma Spa — Al Faisaliyah', 'spa', 'مساج', 'حي الفيصلية، الدمام'],
  ['صالون تجميل نسيم — المزروعية', 'Naseem Beauty — Al Mazruiyah', 'salon', 'أناقة', 'حي المزروعية، الدمام'],
  ['مركز عناية بشرة — الروضة', 'Skin Care — Ar Rawdah', 'clinic', 'بشرة', 'حي الروضة، الدمام'],
  ['صالون شعر روز — الشاطئ', 'Rose Hair — Ash Shati', 'salon', 'صبغات', 'حي الشاطئ، الدمام'],
  ['سبا ومساج أرجان — الريان', 'Argan Spa — Ar Rayyan', 'spa', 'سبا', 'حي الريان، الدمام'],
  ['ستوديو مكياج عروس — المحمدية', 'Bridal Makeup — Al Muhammadiyah', 'salon', 'عرائس', 'حي المحمدية، الدمام'],
  ['صالون إطلالة — العزيزية', 'Itlalah — Al Aziziyah', 'salon', 'تجميل', 'حي العزيزية، الدمام'],
  ['عيادة تجميل بوتيك — الفيصلية', 'Boutique Clinic — Al Faisaliyah', 'clinic', 'حقن', 'حي الفيصلية، الدمام'],
  ['سبا كريستال — النور', 'Crystal Spa — An Nur', 'spa', 'فاخر', 'حي النور، الدمام'],
  ['صالون شعر أندلس — الروضة', 'Andalus Hair — Ar Rawdah', 'salon', 'شعر', 'حي الروضة، الدمام'],
  ['مركز عناية — الشاطئ', 'Care Center — Ash Shati', 'clinic', 'ليزر وعناية', 'حي الشاطئ، الدمام'],
  ['صالون نسائي لمسة — الكورنيش', 'Lamsa Ladies — Corniche', 'salon', 'مكياج', 'كورنيش الدمام، الدمام'],
]

function esc(s) {
  return s.replace(/'/g, "''")
}

function row(cityKey, cityAr, citySelect, data, idx, globalOffset) {
  const [nameAr, nameEn, cat, catLabel, address] = data
  const { lat, lng } = cityKey === 'kh' ? coordKhobar(idx) : coordDammam(idx)
  const ph = phone(globalOffset)
  const cover = covers[globalOffset % covers.length]
  const rating = (3.5 + (globalOffset % 15) * 0.1).toFixed(1)
  const reviews = 8 + (globalOffset * 17) % 120
  const bookings = 10 + (globalOffset * 23) % 200
  const desc = `منشأة نسائية معتمدة في ${cityAr} — ${catLabel}. إحداثيات للعرض على الخريطة؛ راجعي الخرائط قبل الزيارة. ${TAG}`

  return `(
  (${citySelect}),
  '${esc(nameAr)}',
  '${esc(nameEn)}',
  '${esc(desc)}',
  '${cat}',
  '${esc(catLabel)}',
  '${cityAr}',
  '${REGION}',
  '${esc(address)}',
  ${lat}::double precision,
  ${lng}::double precision,
  '${ph}',
  '${ph}',
  '${cover}',
  ARRAY['${cover}']::text[],
  ${opening},
  ${rating}::numeric,
  ${reviews},
  ${bookings},
  'moderate',
  true,
  true,
  false,
  'verified'
)`
}

const khSelect = `SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1`
const dmSelect = `SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1`

const rows = []
let g = 0
for (let i = 0; i < khobarNames.length; i++) {
  rows.push(row('kh', 'الخبر', khSelect, khobarNames[i], i, g))
  g++
}
for (let i = 0; i < dammamNames.length; i++) {
  rows.push(row('dm', 'الدمام', dmSelect, dammamNames[i], i, g))
  g++
}

const sql = `-- ROSERA — 50 منشآت نسائية (الخبر + الدمام) — إحداثيات تقريبية حول 26.2°N 50.1°E
-- يتطلب: صفوف sa_cities للخبر والدمام | تطبيق migration 028 (source_type verified)
-- إعادة التشغيل: يحذف نفس الدفعة ثم يُدرج من جديد
-- أسماء وأرقام نمطية للعرض/الاختبار؛ ليست مطابقة لأعمال تجارية مسجلة فعلياً

BEGIN;

DELETE FROM public.services WHERE business_id IN (
  SELECT id FROM public.businesses WHERE description_ar LIKE '%${TAG}%'
);
DELETE FROM public.businesses WHERE description_ar LIKE '%${TAG}%';

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
console.log('Wrote', out, '—', rows.length, 'rows')
