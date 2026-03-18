/**
 * يولّد 004_seed_sa_full.sql — مناطق + مدن + صالون لكل مدينة + خدمات
 * تشغيل: node scripts/generate-rosera-full-seed.mjs
 */
import { randomUUID } from 'crypto'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { REGION_DATA, REGION_CENTERS } from './data-saudi-regions.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function coord(ri, city) {
  const [lat0, lng0] = REGION_CENTERS[ri]
  const h = hash(city + String(ri))
  return [lat0 + ((h % 180) - 90) / 2200, lng0 + (((h >> 8) % 180) - 90) / 2200]
}

const PREFIX = ['صالون', 'مركز', 'مؤسسة', 'صالون وسبا', 'بيت', 'أكاديمية']
const CORE = [
  'الماسة', 'ورد الجوري', 'لمسات الجمال', 'الأناقة', 'نور', 'الأميرة', 'الجوري', 'الدرة', 'اللؤلؤة', 'الزهور',
  'رونق', 'أصالة', 'سحر الشرق', 'لمسة فنان', 'تألق', 'إشراق', 'النجوم', 'القمر', 'الشمس', 'الربيع',
  'النسيم', 'الأمواج', 'المرجان', 'الياقوت', 'الزمرد', 'الكريستال', 'الحرير', 'الحرير', 'الملكة', 'السلطانة',
  'دانة', 'حوراء', 'ريماس', 'ليان', 'تولين', 'جمانة', 'سندس', 'نغم', 'أريج', 'غزل',
  'شهد', 'ليلى', 'سارة', 'نورة', 'هند', 'دانة الخليج', 'أمواج الخليج', 'بنات الخليج', 'نسيم البحر', 'ساحل الشرق',
  'جمالك', 'بشرتك', 'نعومتك', 'أناقتك', 'رونقك', 'تألقك', 'إطلالتك', 'لمستك', 'عنايتك', 'جمال الروح',
  'النسيم البارد', 'الورد الأحمر', 'الياسمين', 'الفل', 'العطر', 'الكادي', 'البان', 'الزنبق', 'الخزامى', 'البان',
  'لمسة حنان', 'عناية الأم', 'جمال الأمس', 'أناقة اليوم', 'تألق الغد', 'سحر الليل', 'نور الصباح', 'بريق المساء',
  'المرآة', 'الإطلالة', 'الساحرة', 'الجميلة', 'الناعمة', 'الرقيقة', 'الأنيقة', 'الفاتنة', 'المميزة', 'الراقية',
  'لمسة ذهب', 'ورد ذهبي', 'تاج الملكة', 'عرش الجمال', 'سر الجمال', 'مفتاح الأناقة', 'بوابة الجمال', 'درع الأنوثة',
  'أصالة الماضي', 'عراقة الحاضر', 'تجدد المستقبل', 'لمسة الشرق', 'أناقة الغرب', 'جمع الثقافات', 'بيت الأنوثة',
  'دار الجمال', 'روضة الزهور', 'حديقة الورد', 'واحة الجمال', 'نخلة الأناقة', 'قصر الجمال', 'برج الأنوثة',
  'نجوم الليل', 'قمر الصباح', 'شمس الظهيرة', 'فجر الجمال', 'غروب الأناقة', 'نسيم الربيع', 'مطر الشتاء',
  'صيف الأنوثة', 'خريف الجمال', 'ألوان الطيف', 'قوس قزح', 'ألماسة', 'ياقوتة', 'لؤلؤة البحر', 'مرجانة',
  'زهرة الربيع', 'ورقة الخريف', 'ثلج الشتاء', 'رمال الصحراء', 'نجمة الصحراء', 'قمر الصحراء', 'واحة النخيل',
  'نخيل الواحة', 'سيف البنات', 'درع المرأة', 'تاج النساء', 'محيا الجمال', 'بريق العين', 'سحر العيون',
  'جمال العيون', 'رموش الحور', 'خدود الورد', 'شفاه الكرز', 'أظافر الملكة', 'شعر الحورية', 'بشرة الحرير',
]

const CATS = [
  'صالون نسائي',
  'سبا ومساج',
  'مكياج',
  'أظافر',
  'عرائس',
  'عناية بالبشرة',
  'حلاقة أطفال',
]

const IMG_BASE = [
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
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  'https://images.unsplash.com/photo-1560869713-da86aeead2a4?w=800&q=80',
  'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800&q=80',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
]

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function salonName(idx, cityName) {
  const a = PREFIX[idx % PREFIX.length]
  const b = CORE[idx % CORE.length]
  return `${a} ${b} — ${cityName}`
}

function imgUrl(idx, cityId) {
  const base = IMG_BASE[idx % IMG_BASE.length]
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}rosera=${idx}&cid=${cityId.slice(0, 8)}`
}

const SERVICES_POOL = [
  ['قص شعر', 'hair', 80, 35],
  ['صبغة شعر', 'hair', 250, 90],
  ['سشوار', 'hair', 60, 25],
  ['مكياج عروس', 'makeup', 1500, 120],
  ['مكياج سهرة', 'makeup', 350, 60],
  ['مناكير', 'nails', 150, 45],
  ['بدكير وبيدكير', 'nails', 180, 60],
  ['تنظيف بشرة', 'skin', 200, 50],
  ['مساج استرخائي', 'massage', 280, 60],
  ['حمام مغربي', 'massage', 320, 90],
  ['تسريحة عروس', 'bridal', 600, 90],
  ['عناية أطفال', 'hair', 45, 25],
]

const opening = JSON.stringify({
  السبت: { open: '10:00', close: '22:00' },
  الأحد: { open: '10:00', close: '22:00' },
  الاثنين: { open: '10:00', close: '22:00' },
  الثلاثاء: { open: '10:00', close: '22:00' },
  الأربعاء: { open: '10:00', close: '22:00' },
  الخميس: { open: '10:00', close: '23:00' },
  الجمعة: { open: '14:00', close: '22:00' },
}).replace(/'/g, "''")

const regionIds = REGION_DATA.map(() => randomUUID())
const cityRows = []
const businessRows = []
const serviceRows = []
let salonIdx = 0

REGION_DATA.forEach((reg, ri) => {
  const rid = regionIds[ri]
  reg.cities.forEach((cityName) => {
    const cid = randomUUID()
    const [lat, lng] = coord(ri, cityName)
    cityRows.push({ id: cid, region_id: rid, name_ar: cityName, lat, lng })
    const bid = randomUUID()
    const cat = CATS[salonIdx % CATS.length]
    const rating = (4 + (salonIdx % 10) / 10).toFixed(1)
    const phone = `+9665${String(10000000 + (salonIdx % 89999999)).padStart(8, '0')}`
    const n = salonName(salonIdx, cityName)
    const desc = `${n} صالون راقٍ في قلب ${cityName}. نقدّم أحدث تقنيات التجميل والعناية بفريق محترف وبيئة مريحة لجميع العميلات.`
    const addr = `حي النخيل، ${cityName}، ${reg.name.replace('منطقة ', '')}`
    const img = imgUrl(salonIdx, cid)
    const imgs = `ARRAY['${esc(img)}','${esc(IMG_BASE[(salonIdx + 1) % IMG_BASE.length])}']`
    businessRows.push({
      id: bid,
      city_id: cid,
      city: cityName,
      region: reg.name,
      name_ar: n,
      desc,
      addr,
      lat,
      lng,
      phone,
      rating,
      cat,
      img,
      imgs,
    })
    const nSvc = 3 + (salonIdx % 3)
    for (let s = 0; s < nSvc; s++) {
      const sp = SERVICES_POOL[(salonIdx + s) % SERVICES_POOL.length]
      serviceRows.push({ business_id: bid, name_ar: sp[0], cat: sp[1], price: sp[2] + (salonIdx % 5) * 10, dur: sp[3] })
    }
    salonIdx++
  })
})

let sql = `-- روزيرا: بذرة كاملة — نفّذي بعد 003_sa_regions_rebuild.sql
BEGIN;

INSERT INTO public.sa_regions (id, name_ar, capital_ar, image_url, sort_order) VALUES\n`

sql += REGION_DATA.map(
  (r, i) =>
    `('${regionIds[i]}', '${esc(r.name)}', '${esc(r.capital)}', '${esc(r.img)}', ${i + 1})`
).join(',\n')

sql += `;\n\nINSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude) VALUES\n`
sql += cityRows.map((c) => `('${c.id}', '${c.region_id}', '${esc(c.name_ar)}', ${c.lat}, ${c.lng})`).join(',\n')
sql += `;\n\nINSERT INTO public.businesses (id, city_id, name_ar, description_ar, category, category_label, city, region, address_ar, latitude, longitude, phone, whatsapp, cover_image, images, opening_hours, average_rating, total_reviews, total_bookings, price_range, is_active, is_verified) VALUES\n`

sql += businessRows
  .map(
    (b) =>
      `('${b.id}', '${b.city_id}', '${esc(b.name_ar)}', '${esc(b.desc)}', 'salon', '${esc(b.cat)}', '${esc(b.city)}', '${esc(b.region)}', '${esc(b.addr)}', ${b.lat}, ${b.lng}, '${b.phone}', '${b.phone}', '${esc(b.img)}', ${b.imgs}, '${opening}'::jsonb, ${b.rating}, ${8 + (hash(b.id) % 40)}, ${20 + (hash(b.id) % 100)}, 'moderate', true, true)`
  )
  .join(',\n')

sql += `;\n\nINSERT INTO public.services (business_id, name_ar, category, price, duration_minutes, is_active) VALUES\n`
sql += serviceRows
  .map((s) => `('${s.business_id}', '${esc(s.name_ar)}', '${s.cat}', ${s.price}, ${s.dur}, true)`)
  .join(',\n')

sql += `;\n\nCOMMIT;\n`

const out = join(__dirname, '../supabase/migrations/004_seed_sa_full.sql')
writeFileSync(out, sql)
console.log('Wrote', out, 'regions:', regionIds.length, 'cities/salons:', cityRows.length, 'services:', serviceRows.length)
