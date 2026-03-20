-- ROSERA — Manual seed Batch 10 (women-only, Eastern Province).
-- Paste was ~32 lines (not 70). De-dup vs `manual_batch_02`–`09` using **phone + Arabic trade name / brand**.
-- **9 inserts** below. See `SKIPPED_DUPLICATES` for the rest.
--
-- SKIPPED_DUPLICATES (non-exhaustive; primary reason):
--   0138496666 — batch 07 `عيادات أدفانسد تاتش` (الخبر، الحزام الأخضر)
--   0566774433 — batch 08 `مركز سندريلا للتزيين` القطيف
--   0500112299 — batch 05 `مركز هير ستيشن` الخبر (نفس الرقم)
--   لمسة الكادي (الجبيل) — same brand as batch 06 `مركز لمسة الكادي للعرائس`
--   صالون ليلة زفافي (المبرز) — batch 05/06 `صالون ليلة زفافي` / `...النسائي` (نفس العلامة)
--   مشغل ريما للتزيين (سيهات 2) — same phone as batch 08 `مركز سندريلا للتزيين`
--   تيب آند تو / نيل بار / أظافر لولو — brand أو رقم موجود في 02–09
--   دانة، قرية العليا، زهرة الخفجي، نجمة بقيق، ريتاج، لمسة الجمال، فتون، لومير — نفس أسماء/سلاسل الدفعات السابقة (أرقام متاخمة فقط)
--   سبا لافندر الشاطئ — سلسلة `لافندر` كمساج نسائي في 06/07
--   مركز بيلار الطبي (فرع 2) — علامة `بيلار` في batch 02
--   مركز نبض الطبي (فرع القطيف) — علامة `نبض الطبي` في batch 06 (الدمام)
--   سبا قصر لوزان (فرع السلمانية) — علامة `قصر لوزان` في batch 07 (هاتف مختلف لكن نفس الاسم التجاري)
--   مركز مساج الندى (فرع القطيف) — علامة `مساج الندى` في batch 06 (الجبيل)
--
-- Coordinates: district-level approximations — refine via Maps for production.
-- is_demo = false, source_type = 'manual'

BEGIN;

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'الظهران', 26.304, 50.103
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'الظهران'
);

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
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مركز كوكوون الطبي (Cocoon)',
  'Cocoon Medical Center',
  'عيادات جلدية وتجميل — الخبر، طريق الأمير تركي.',
  'clinic',
  'عيادات تجميل',
  'الخبر',
  'المنطقة الشرقية',
  'طريق الأمير تركي، الخبر',
  26.3016,
  50.1864,
  '0138020555',
  '0138020555',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مجمع عيادات شفاء الدمام (جلدية وليزر)',
  'Shifa Al Dammam Clinics — Dermatology & Laser',
  'جلدية وليزر — الدمام، حي الجلوية.',
  'clinic',
  'عيادات جلدية وتجميل',
  'الدمام',
  'المنطقة الشرقية',
  'حي الجلوية، الدمام',
  26.4542,
  50.1142,
  '0138171111',
  '0138171111',
  'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الهفوف' LIMIT 1),
  'عيادة الجمال الماسي (Diamond Beauty)',
  'Diamond Beauty Clinic',
  'تجميل وجلدية — الأحساء (الهفوف).',
  'clinic',
  'عيادات تجميل',
  'الهفوف',
  'المنطقة الشرقية',
  'الهفوف، الأحساء',
  25.3836,
  49.5878,
  '0135815544',
  '0135815544',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.46::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مجمع عيادات المنار الطبي (قسم النساء)',
  'Al Manar Medical Complex — Women''s Section',
  'مجمع طبي قسم نسائي — الدمام، حي المنار.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الدمام',
  'المنطقة الشرقية',
  'حي المنار، الدمام',
  26.4392,
  50.0566,
  '0138112233',
  '0138112233',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.49::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'عيادة د. وسيم الطبيب (تجميل وجلدية)',
  'Dr. Wasim Clinic — Aesthetics & Dermatology',
  'جلدية وتجميل — الخبر، حي العليا.',
  'clinic',
  'عيادات جلدية وتجميل',
  'الخبر',
  'المنطقة الشرقية',
  'حي العليا، الخبر',
  26.2985,
  50.1978,
  '0138877711',
  '0138877711',
  'https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مشغل ليدي ديانا للعرائس',
  'Lady Diana Bridal Salon',
  'تجهيز عرائس — الدمام، حي أحد.',
  'salon',
  'صالونات عرائس',
  'الدمام',
  'المنطقة الشرقية',
  'حي أحد، الدمام',
  26.4905,
  50.2182,
  '0504422119',
  '0504422119',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.52::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مركز أطياف للعرائس',
  'Atyaf Bridal Center',
  'عرائس — الخبر، حي العقربية (علامة منفصلة عن `مشغل أطياف النسائي` في بقيق بدفعة 5).',
  'salon',
  'صالونات عرائس',
  'الخبر',
  'المنطقة الشرقية',
  'حي العقربية، الخبر',
  26.2942,
  50.2194,
  '0566334400',
  '0566334400',
  'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.5::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مركز هدوء المساج (فرع الخبر - حي الثقبة)',
  'Hudu Massage Center — Al Thuqba Branch',
  'مساج للسيدات — الخبر، حي الثقبة (اسم فرع منفصل عن `مركز هدوء المساج النسائي` بدمام في دفعة 7).',
  'spa',
  'سبا ومساج',
  'الخبر',
  'المنطقة الشرقية',
  'حي الثقبة، الخبر',
  26.3212,
  50.2144,
  '0533221155',
  '0533221155',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.41::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الظهران' LIMIT 1),
  'سبا فندق راديسون بلو (قسم السيدات)',
  'Radisson Blu Hotel Spa — Ladies',
  'سبا فندقي للسيدات — الظهران.',
  'spa',
  'سبا ومساج',
  'الظهران',
  'المنطقة الشرقية',
  'الظهران (فندق راديسون بلو)',
  26.2912,
  50.1598,
  '0138750000',
  '0138750000',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.55::numeric, 0, 0, 'upscale', true, false, false, 'manual'
);

COMMIT;
