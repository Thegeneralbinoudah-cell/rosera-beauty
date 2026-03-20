/**
 * يولد 014_eastern_province_full.sql — مدن الظهران والعيون + صالونات وعيادات المنطقة الشرقية
 * تشغيل: node scripts/seed-eastern-province.mjs
 */
import { writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

const REGION_ID = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'
const CITIES = [
  { id: 'b4c8185e-557d-4a83-b9bd-3f210cb200a5', name: 'الخبر', lat: 26.3807, lng: 50.0724 },
  { id: 'bdddbe45-81c5-4674-91b9-f4b7541801a5', name: 'الدمام', lat: 26.4175, lng: 50.0543 },
  { id: 'd2000001-0001-4000-8000-000000000001', name: 'الظهران', lat: 26.2880, lng: 50.1140 },
  { id: '8e3458a4-ca9a-4384-8aaa-5c310c04ee3c', name: 'القطيف', lat: 26.3875, lng: 50.0647 },
  { id: 'a578c509-8bf1-41a7-8ce5-14fe75247158', name: 'الجبيل', lat: 26.4184, lng: 50.1243 },
  { id: '04c37aae-ea97-415d-9b44-e9481acbadba', name: 'الأحساء', lat: 25.3894, lng: 49.5864 },
  { id: 'ef16a3ff-093d-475c-a543-00dfeb709b89', name: 'حفر الباطن', lat: 28.4344, lng: 45.9637 },
  { id: '2a67365d-dc6a-425e-a308-cabb82be7ca9', name: 'رأس تنورة', lat: 26.4130, lng: 50.0590 },
  { id: 'fac0f1a6-aaa8-4360-af7d-a59b1452e208', name: 'الخفجي', lat: 28.4391, lng: 48.4913 },
  { id: '79e36e91-3ebb-4384-ac9a-d8f5a8f70973', name: 'بقيق', lat: 25.9406, lng: 49.6667 },
  { id: 'd9cf27ae-28af-470f-b81a-fce88bac0b6f', name: 'النعيرية', lat: 27.4748, lng: 48.5034 },
  { id: 'd2000002-0002-4000-8000-000000000002', name: 'العيون', lat: 25.6167, lng: 49.6167 },
]

const CATEGORIES = [
  { label: 'صالونات تجميل نسائية', category: 'salon' },
  { label: 'عيادات تجميل', category: 'clinic' },
  { label: 'عيادات عناية بصحة المرأة', category: 'clinic' },
  { label: 'صالونات حلاقة رجالية', category: 'salon' },
  { label: 'سبا ومساج', category: 'spa' },
  { label: 'صالونات أظافر', category: 'salon' },
  { label: 'صالونات عناية بالبشرة', category: 'salon' },
  { label: 'صالونات عناية بالشعر', category: 'salon' },
  { label: 'صالونات عرائس', category: 'salon' },
]

const NAMES = [
  'ليالي', 'الياسمين', 'ديرما كلينك', 'ورد الخليج', 'لمسة أنثى', 'نور البشرة', 'سيدتي', 'جمالك', 'روعة', 'أناقة',
  'سحر الشرق', 'قمر', 'لؤلؤة', 'الماسة', 'الدرة', 'رونق', 'تألق', 'إشراق', 'لمسات', 'حياة',
  'عناية', 'جمال', 'استجمام', 'سيدة', 'وردة', 'زهرة', 'ربيع', 'نسيم', 'راحة', 'سعادة',
]

const OPENING_HOURS = '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'
function unsplashBeauty(index) {
  // Unique URL per business to avoid repeated photos
  return `https://source.unsplash.com/1200x900/?beauty,salon,spa,clinic&sig=${index}`
}

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function addOffset(lat, lng, i) {
  const d = 0.008
  const j = i % 16
  return [lat + (j % 4) * d * 0.5 - d, lng + Math.floor(j / 4) * d * 0.5 - d]
}

const servicesByCategory = {
  'صالونات تجميل نسائية': [
    { name_ar: 'قص وتصفيف', price: 80, dur: 45 },
    { name_ar: 'مكياج كامل', price: 150, dur: 60 },
    { name_ar: 'عناية بالبشرة', price: 120, dur: 50 },
  ],
  'عيادات تجميل': [
    { name_ar: 'استشارة تجميلية', price: 200, dur: 30 },
    { name_ar: 'حقن فيلر', price: 1500, dur: 45 },
    { name_ar: 'ليزر إزالة شعر', price: 350, dur: 40 },
  ],
  'عيادات عناية بصحة المرأة': [
    { name_ar: 'فحص دوري', price: 250, dur: 45 },
    { name_ar: 'استشارة تغذوية', price: 150, dur: 30 },
  ],
  'صالونات حلاقة رجالية': [
    { name_ar: 'حلاقة لحية', price: 40, dur: 25 },
    { name_ar: 'قص شعر رجالي', price: 50, dur: 30 },
  ],
  'سبا ومساج': [
    { name_ar: 'مساج استرخائي', price: 280, dur: 60 },
    { name_ar: 'حمام مغربي', price: 350, dur: 90 },
    { name_ar: 'مساج أقدام', price: 120, dur: 45 },
  ],
  'صالونات أظافر': [
    { name_ar: 'مناكير', price: 80, dur: 45 },
    { name_ar: 'بدكير وبيدكير', price: 120, dur: 60 },
  ],
  'صالونات عناية بالبشرة': [
    { name_ar: 'تنظيف بشرة', price: 180, dur: 50 },
    { name_ar: 'قناع مغذي', price: 120, dur: 30 },
  ],
  'صالونات عناية بالشعر': [
    { name_ar: 'قص وتصفيف', price: 100, dur: 45 },
    { name_ar: 'صبغة شعر', price: 250, dur: 90 },
    { name_ar: 'سشوار', price: 60, dur: 25 },
  ],
  'صالونات عرائس': [
    { name_ar: 'مكياج عروس', price: 1200, dur: 120 },
    { name_ar: 'تسريحة عروس', price: 800, dur: 90 },
  ],
}

let businessIndex = 0
const businessIds = []
const out = []

out.push('-- المنطقة الشرقية: إضافة الظهران والعيون ثم صالونات وعيادات (لا يحذف بيانات موجودة)')
out.push('')
out.push("INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude) VALUES")
out.push("  ('d2000001-0001-4000-8000-000000000001', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الظهران', 26.2880, 50.1140),")
out.push("  ('d2000002-0002-4000-8000-000000000002', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'العيون', 25.6167, 49.6167)")
out.push(';')
out.push('')

const bizRows = []
const svcRows = []

for (const city of CITIES) {
  const count = city.name === 'الدمام' || city.name === 'الخبر' ? 20 : 15
  for (let i = 0; i < count; i++) {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const name1 = NAMES[Math.floor(Math.random() * NAMES.length)]
    const name2 = NAMES[(i + 5) % NAMES.length]
    const salonName = `${name1} ${name2} — ${city.name}`
    const bid = randomUUID()
    businessIds.push({ id: bid, city_id: city.id, city_name: city.name, category_label: cat.label })
    const [lat, lng] = addOffset(city.lat, city.lng, businessIndex)
    const rating = (3.5 + Math.random() * 1.5).toFixed(1)
    const reviews = 5 + Math.floor(Math.random() * 50)
    const phone = `05${String(10000000 + Math.floor(Math.random() * 89999999))}`
    const desc = `مركز تجميل وعناية في ${city.name}. نقدم خدمات متكاملة بفريق متخصص وبيئة مريحة.`
    const cover = unsplashBeauty(businessIndex + 1)
    const image2 = unsplashBeauty(businessIndex + 1001)
    bizRows.push(`('${bid}', '${city.id}', '${esc(salonName)}', '${esc(desc)}', '${cat.category}', '${esc(cat.label)}', '${esc(city.name)}', 'المنطقة الشرقية', 'حي النخيل، ${esc(city.name)}', ${lat}, ${lng}, '+966${phone.slice(1)}', '+966${phone.slice(1)}', '${cover}', ARRAY['${cover}','${image2}'], '${OPENING_HOURS}'::jsonb, ${rating}, ${reviews}, 0, 'moderate', true, true)`)
    businessIndex++

    const svcs = servicesByCategory[cat.label] || servicesByCategory['صالونات تجميل نسائية']
    for (const s of svcs) {
      svcRows.push(`('${bid}', '${esc(s.name_ar)}', '${s.name_ar.length > 10 ? 'skin' : 'hair'}', ${s.price}, ${s.dur}, true)`)
    }
  }
}

out.push('INSERT INTO public.businesses (id, city_id, name_ar, description_ar, category, category_label, city, region, address_ar, latitude, longitude, phone, whatsapp, cover_image, images, opening_hours, average_rating, total_reviews, total_bookings, price_range, is_active, is_verified) VALUES')
out.push(bizRows.join(',\n'))
out.push('ON CONFLICT (id) DO NOTHING;')
out.push('')
out.push('INSERT INTO public.services (business_id, name_ar, category, price, duration_minutes, is_active) VALUES')
out.push(svcRows.join(',\n') + ';')

writeFileSync(
  new URL('../supabase/migrations/014_eastern_province_full.sql', import.meta.url),
  out.join('\n')
)
console.log('Written 014_eastern_province_full.sql with', businessIds.length, 'businesses and', svcRows.length, 'services')
console.log('Per city:', [...new Set(businessIds.map(b => b.city_name))].map(c => ({
  city: c,
  count: businessIds.filter(b => b.city_name === c).length
})))
