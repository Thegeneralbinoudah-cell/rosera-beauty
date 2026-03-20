-- ROSERA — Manual seed Batch 8 (women-only, Eastern Province).
-- Operator message listed ~32 lines (not 80); after de-duplication vs batches 02–07: **20 inserts** below.
--
-- SKIPPED_DUPLICATES (existing phone / same listing in earlier manual seeds):
--   0504488221 أتيليه روعة الزفاف — batch 02 `مركز زهرة اللوتس للتجميل`
--   0138827722 مجمع عيادات كحل — batch 05 `مجمع عيادات كحل` (نفس الحي والرقم)
--   0138339411 مركز شعاع الطبي — batch 05 `مركز تداوي الطبي` الدمام
--   0500112233 مجمع عيادات النخبة — batch 06 `مركز مساج الندى النسائي` (نفس الرقم)
--   0133415566 مساج الندى 2 — batch 03/06 `مجمع عيادات كير` / ندى بنفس الرقم
--   0544332211 مركز جليتر للعرائس — batch 05 `صالون توت للأظافر` الدمام
--   0566771122 مشغل ريتاج للزفاف الخفجي — batch 07 `مشغل لمسة مخملية` سيهات
--   0544119933 سبا وادي الراحة — batch 06 (مخملية صفوى + لومير دمام يستخدمان نفس الرقم)
--   0533112255 أظافر المها — batch 05 `مركز أظافر المها` (نفس الرقم)
--   0544778833 مركز نضارة بلس — batch 03 `صالون لمسة حرير للشعر` رأس تنورة
--   0566334455 قرية العليا — batch 02 `مشغل لومير النسائي` الدمام
--   0501122334 مشغل فتون البطحاء — batch 05 `مشغل غلا النسائي` النعيرية
--
-- is_demo = false, source_type = 'manual'

BEGIN;

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'الظهران', 26.304, 50.103
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'الظهران'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'تاروت', 26.5750, 50.0640
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'تاروت'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'عنك', 26.5400, 49.9900
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'عنك'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'صفوى', 26.6992, 49.9422
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'صفوى'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'سيهات', 26.4860, 50.0338
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'سيهات'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'سلوى', 24.0690, 51.1070
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'سلوى'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'البطحاء', 25.1750, 49.5970
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'البطحاء'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'قرية العليا', 25.6160, 49.6950
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'قرية العليا'
);

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT gen_random_uuid(), 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid, 'رأس تنورة', 26.7070, 50.0610
WHERE NOT EXISTS (
  SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND c.name_ar = 'رأس تنورة'
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
-- صالونات عرائس
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مركز دار الهنوف للعرائس',
  'Dar Al Hanouf Bridal Center',
  'تجهيز عرائس — الخبر، حي التحلية. دفعة 8.',
  'salon',
  'صالونات عرائس',
  'الخبر',
  'المنطقة الشرقية',
  'حي التحلية، الخبر',
  26.2800,
  50.2100,
  '0138944778',
  '0138944778',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.5::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الأحساء' LIMIT 1),
  'مشغل ليلة العمر (فرع المبرز 2)',
  'Laylat Al Omr Salon — Al Mubarraz 2',
  'عرائس — الأحساء (المبرز)، فرع إضافي. رقم هاتف مميز عن فرع دفعة 4.',
  'salon',
  'صالونات عرائس',
  'الأحساء',
  'المنطقة الشرقية',
  'المبرز، الأحساء',
  25.4010,
  49.5690,
  '0544773355',
  '0544773355',
  'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.46::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'القطيف' LIMIT 1),
  'مركز سندريلا للتزيين',
  'Cinderella Styling Center',
  'تزيين وعرائس — القطيف، حي المجيدية.',
  'salon',
  'صالونات عرائس',
  'القطيف',
  'المنطقة الشرقية',
  'حي المجيدية، القطيف',
  26.5720,
  49.9980,
  '0566774433',
  '0566774433',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.44::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'حفر الباطن' LIMIT 1),
  'صالون برنسيسة العرب للعرائس',
  'Princess of Arabia Bridal Salon',
  'عرائس — حفر الباطن، حي الربوة.',
  'salon',
  'صالونات عرائس',
  'حفر الباطن',
  'المنطقة الشرقية',
  'حي الربوة، حفر الباطن',
  28.4320,
  45.9620,
  '0500119977',
  '0500119977',
  'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.41::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
-- عيادات
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الجبيل' LIMIT 1),
  'عيادات رام (قسم التجميل النسائي)',
  'Ram Clinics — Women''s Aesthetics',
  'تجميل نسائي — الجبيل، حي مكة.',
  'clinic',
  'عيادات تجميل',
  'الجبيل',
  'المنطقة الشرقية',
  'حي مكة، الجبيل',
  27.0210,
  49.6585,
  '920004411',
  '920004411',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الهفوف' LIMIT 1),
  'مركز لافندر الطبي للتجميل',
  'Lavender Medical Aesthetics Center',
  'عيادة تجميل — الهفوف، حي السلمانية.',
  'clinic',
  'عيادات تجميل',
  'الهفوف',
  'المنطقة الشرقية',
  'حي السلمانية، الهفوف',
  25.3620,
  49.5680,
  '0135800044',
  '0135800044',
  'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'حفر الباطن' LIMIT 1),
  'عيادة نبض الجمال',
  'Nabd Al Jamal Clinic',
  'جلدية وتجميل — حفر الباطن، طريق الملك خالد.',
  'clinic',
  'عيادات تجميل',
  'حفر الباطن',
  'المنطقة الشرقية',
  'طريق الملك خالد، حفر الباطن',
  28.4280,
  45.9700,
  '0137210044',
  '0137210044',
  'https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.42::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخفجي' LIMIT 1),
  'مركز تداوي الطبي (ليزر وتجميل)',
  'Tadawi Medical — Laser & Aesthetics',
  'ليزر وتجميل — الخفجي (اسم تجاري منفصل عن مجمع تداوي الدمام).',
  'clinic',
  'عيادات تجميل',
  'الخفجي',
  'المنطقة الشرقية',
  'الخفجي',
  28.7920,
  48.5140,
  '0533441122',
  '0533441122',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.45::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
-- سبا
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مركز الاسترخاء الملكي للسيدات',
  'Royal Relaxation Ladies Center',
  'سبا ومساج — الدمام، حي الفيصلية.',
  'spa',
  'سبا ومساج',
  'الدمام',
  'المنطقة الشرقية',
  'حي الفيصلية، الدمام',
  26.4520,
  50.0860,
  '0500662244',
  '0500662244',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.49::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الهفوف' LIMIT 1),
  'سبا فندق انتركونتيننتال (للسيدات)',
  'InterContinental Hotel Spa — Ladies',
  'سبا فندقي قسم سيدات — الأحساء (الهفوف).',
  'spa',
  'سبا ومساج',
  'الهفوف',
  'المنطقة الشرقية',
  'الهفوف، الأحساء (فندق انتركونتيننتال)',
  25.3640,
  49.5720,
  '0135332211',
  '0135332211',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.56::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الظهران' LIMIT 1),
  'سبا لوتس الجمال',
  'Lotus Beauty Spa',
  'سبا نسائي — الظهران، حي الدوحة.',
  'spa',
  'سبا ومساج',
  'الظهران',
  'المنطقة الشرقية',
  'حي الدوحة، الظهران',
  26.3040,
  50.1030,
  '0566330011',
  '0566330011',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.43::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
-- صالونات
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'صالون نيل بار (فرع الراكة)',
  'Nail Bar — Al Rakah Branch',
  'أظافر — الخبر، حي الراكة.',
  'salon',
  'صالونات أظافر',
  'الخبر',
  'المنطقة الشرقية',
  'حي الراكة، الخبر',
  26.2640,
  50.2070,
  '0533229977',
  '0533229977',
  'https://images.unsplash.com/photo-1610992015732-2444b2e4c859?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1610992015732-2444b2e4c859?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.37::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'النعيرية' LIMIT 1),
  'مشغل زهرة النعيرية (فرع المحمدية)',
  'Al Nuwayriyah Flower Salon — Al Muhammadiyah',
  'مشغل نسائي — النعيرية، حي المحمدية.',
  'salon',
  'صالونات تجميل نسائية',
  'النعيرية',
  'المنطقة الشرقية',
  'حي المحمدية، النعيرية',
  27.4720,
  48.4900,
  '0504991122',
  '0504991122',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.32::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'بقيق' LIMIT 1),
  'صالون نجمة بقيق النسائي',
  'Buqayq Star Ladies Salon',
  'صالون نسائي — بقيق، حي الروضة.',
  'salon',
  'صالونات تجميل نسائية',
  'بقيق',
  'المنطقة الشرقية',
  'حي الروضة، بقيق',
  25.9360,
  49.6200,
  '0544119922',
  '0544119922',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.31::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'رأس تنورة' LIMIT 1),
  'مركز العناية بالبشرة والجمال (رأس تنورة)',
  'Skin & Beauty Care Center — Ras Tanura',
  'عناية بالبشرة — رأس تنورة (اسم مميز عن مراكز بنفس الاسم في مدن أخرى بالدفعات السابقة).',
  'salon',
  'صالونات عناية بالبشرة',
  'رأس تنورة',
  'المنطقة الشرقية',
  'رأس تنورة',
  26.4180,
  50.0620,
  '0533221188',
  '0533221188',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.33::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'عنك' LIMIT 1),
  'مشغل عنك للتزيين (فرع الخيل)',
  'Anak Styling Salon — Al Khayl Branch',
  'تزيين نسائي — عنك، شارع الخيل.',
  'salon',
  'صالونات تجميل نسائية',
  'عنك',
  'المنطقة الشرقية',
  'شارع الخيل، عنك',
  26.5400,
  49.9900,
  '0566442233',
  '0566442233',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.3::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'سلوى' LIMIT 1),
  'صالون لمسة الجمال',
  'Lamsat Al Jamal Salon',
  'صالون نسائي — سلوى.',
  'salon',
  'صالونات تجميل نسائية',
  'سلوى',
  'المنطقة الشرقية',
  'سلوى، المنطقة السكنية',
  24.0690,
  51.1070,
  '0501199221',
  '0501199221',
  'https://images.unsplash.com/photo-1629909615184-7ee455ee2a07?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1629909615184-7ee455ee2a07?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.28::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'سيهات' LIMIT 1),
  'مركز لومير للعناية بالشعر',
  'Lumière Hair Care — Sihat',
  'عناية بالشعر — سيهات.',
  'salon',
  'صالونات عناية بالشعر والبشرة',
  'سيهات',
  'المنطقة الشرقية',
  'سيهات',
  26.4860,
  50.0338,
  '0544119944',
  '0544119944',
  'https://images.unsplash.com/photo-1562322140-8ee00cf35a9a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1562322140-8ee00cf35a9a?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.36::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'تاروت' LIMIT 1),
  'صالون دار ريتاج للتجميل',
  'Dar Retaj Beauty Salon',
  'تجميل نسائي — تاروت.',
  'salon',
  'صالونات تجميل نسائية',
  'تاروت',
  'المنطقة الشرقية',
  'تاروت',
  26.5750,
  50.0640,
  '0566332255',
  '0566332255',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.34::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'صفوى' LIMIT 1),
  'مشغل لمسات وردية',
  'Pink Touches Salon',
  'مشغل نسائي — صفوى.',
  'salon',
  'صالونات تجميل نسائية',
  'صفوى',
  'المنطقة الشرقية',
  'صفوى',
  26.6992,
  49.9422,
  '0555331144',
  '0555331144',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.35::numeric, 0, 0, 'moderate', true, false, false, 'manual'
);

COMMIT;
