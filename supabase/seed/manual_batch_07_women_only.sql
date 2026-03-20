-- ROSERA — Manual seed Batch 7 (women-only). Part 1: entries vetted unique vs `manual_batch_02`–`06`.
-- Operator asked for 100; this paste was ~40 lines — many were duplicates of earlier seeds (skipped below).
-- When you receive the remaining ~60 names, append more tuples before COMMIT or add `manual_batch_07b_*.sql`.
--
-- SKIPPED_DUPLICATES (same phone and/or same business as batches 02–06):
--   920001188 مركز المانع الطبي — already in batch 03/04
--   0500115599 مركز بيلار — batch 02 `مركز بيلار للتجميل` (حي مكة)
--   0133411000 مذهلة فرع الفناتير — batch 02 spa الفناتير same phone
--   0504953321 دانة النعيرية فرع العزيزية — batch 06 `مشغل دانة النعيرية النسائي`
--   0566443322 ريتاج فرع المحمدية — batch 06 `مشغل ريتاج النسائي`
--   0533441100 ريلاكس سبا فرع المحمدية حفر الباطن — same phone as batch 06 الخبر `مركز ريلاكس سبا`
--   0504488221 زهرة اللوتس — batch 02 `مركز زهرة اللوتس للتجميل`
--   0555994433 لمسات السعادة — batch 02 `صالون لمسات السعادة`
--   0566887755 فتون — batch 02 `مشغل فتون النسائي`
--   0544223399 فيولا فرع الجسر — batch 02 `صالون فيولا النسائي`
--   0138991144 تيب آند تو سبا الراشد — batch 02 `مركز تيب آند تو`
--   0544772211 نون — batch 02 `صالون نون النسائي`
--   0555998811 نجمة رأس تنورة — batch 05 `مركز لمسة إبداع` النعيرية same phone
--   0544332211 لمسة الخفجي فرع الملك فيصل — batch 05 `صالون توت للأظافر` الدمام same phone
--   0505801199 أتيليه ليلة العمر الشاطئ — batch 04 `أتيليه العروسة الفاتنة` same phone
--   0544773322 مشغل ليلة العمر المبرز — batch 04 `صالون لمسة إبداع للعرائس` same phone
--   0501199334 ملكة جمال تاروت — batch 04 `صالون ملكة جمال تاروت`
--
-- is_demo = false, source_type = 'manual', region = المنطقة الشرقية

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
-- ━━━ عيادات ━━━
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'عيادات تالين الطبية (فرع العقربية)',
  'Talin Clinics — Al Uqayriyah Branch',
  'قسم ليزر ونسائية — الخبر، حي العقربية. دفعة 7 (بدون تكرار مع الدفعات السابقة).',
  'clinic',
  'عيادات تجميل',
  'الخبر',
  'المنطقة الشرقية',
  'حي العقربية، الخبر',
  26.2950,
  50.2200,
  '920002231',
  '920002231',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.5::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'عيادات أدفانسد تاتش',
  'Advanced Touch Clinics',
  'تجميل وليزر نسائي — الخبر، حي الهدا.',
  'clinic',
  'عيادات تجميل',
  'الخبر',
  'المنطقة الشرقية',
  'حي الهدا، الخبر',
  26.2900,
  50.1880,
  '0138496666',
  '0138496666',
  'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مجمع عيادات ايفا الطبية (فرع الفيصلية)',
  'Eva Medical Complex — Al Faisaliyah',
  'ليزر وتجميل نسائي — الدمام، حي الفيصلية (فرع مميز عن فرع الزهور في دفعة 6).',
  'clinic',
  'عيادات جلدية وتجميل',
  'الدمام',
  'المنطقة الشرقية',
  'حي الفيصلية، الدمام',
  26.4520,
  50.0860,
  '0138114455',
  '0138114455',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'عيادات د. غسان فرعون (قسم النساء)',
  'Dr. Ghassan Faroun Clinics — Women''s Section',
  'عيادات متعددة قسم نسائي — الخبر.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الخبر',
  'المنطقة الشرقية',
  'الخبر',
  26.2920,
  50.2080,
  '0138575555',
  '0138575555',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.52::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الهفوف' LIMIT 1),
  'مركز الرعاية النسائية الأول',
  'First Women''s Care Center',
  'رعاية صحة المرأة — الأحساء (الهفوف).',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الهفوف',
  'المنطقة الشرقية',
  'الهفوف، الأحساء',
  25.3840,
  49.5880,
  '0135811223',
  '0135811223',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.45::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'القطيف' LIMIT 1),
  'مجمع عيادات رويال',
  'Royal Medical Complex',
  'مجمع عيادات — القطيف، حي الناصرة.',
  'clinic',
  'عيادات تجميل',
  'القطيف',
  'المنطقة الشرقية',
  'حي الناصرة، القطيف',
  26.5510,
  49.9910,
  '0138520033',
  '0138520033',
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.46::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'حفر الباطن' LIMIT 1),
  'عيادة لافندر للجلدية',
  'Lavender Dermatology Clinic',
  'جلدية وليزر — حفر الباطن.',
  'clinic',
  'عيادات جلدية وتجميل',
  'حفر الباطن',
  'المنطقة الشرقية',
  'حفر الباطن',
  28.4320,
  45.9650,
  '0137215500',
  '0137215500',
  'https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1584982751601-97dcc0969c4a?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.4::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخفجي' LIMIT 1),
  'مركز بسمة المرأة الطبي',
  'Basma Women''s Medical Center',
  'خدمات طبية نسائية — الخفجي.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الخفجي',
  'المنطقة الشرقية',
  'الخفجي',
  28.7900,
  48.5120,
  '0544223366',
  '0544223366',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.44::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
-- ━━━ عرائس ━━━
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'صالون لادونا للعرائس',
  'Ladona Bridal Salon',
  'تجهيز عرائس — الخبر، حي العقربية.',
  'salon',
  'صالونات عرائس',
  'الخبر',
  'المنطقة الشرقية',
  'حي العقربية، الخبر',
  26.2960,
  50.2190,
  '0138822554',
  '0138822554',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'سيهات' LIMIT 1),
  'مشغل سحر العروس',
  'Sihr Al Arus Bridal Salon',
  'عرائس — سيهات، شارع المنتزه.',
  'salon',
  'صالونات عرائس',
  'سيهات',
  'المنطقة الشرقية',
  'شارع المنتزه، سيهات',
  26.4860,
  50.0338,
  '0544331188',
  '0544331188',
  'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.42::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'صفوى' LIMIT 1),
  'مركز ريما لليلة الزفاف',
  'Reema Wedding Night Center',
  'تجهيز عرائس — صفوى.',
  'salon',
  'صالونات عرائس',
  'صفوى',
  'المنطقة الشرقية',
  'صفوى',
  26.6992,
  49.9422,
  '0566332211',
  '0566332211',
  'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.45::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
-- ━━━ سبا ━━━
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'سبا فندق موفنبيك (للسيدات)',
  'Mövenpick Hotel Spa — Ladies',
  'سبا فندقي قسم سيدات — الخبر.',
  'spa',
  'سبا ومساج',
  'الخبر',
  'المنطقة الشرقية',
  'الخبر (فندق موفنبيك)',
  26.3010,
  50.2000,
  '0138984999',
  '0138984999',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.55::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مركز هدوء المساج النسائي',
  'Hudu Women''s Massage Center',
  'مساج واسترخاء للسيدات — الدمام، حي طيبة.',
  'spa',
  'سبا ومساج',
  'الدمام',
  'المنطقة الشرقية',
  'حي طيبة، الدمام',
  26.4620,
  50.0280,
  '0533221144',
  '0533221144',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.4::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'سبا المنهل الصحي (فرع الريان)',
  'Al Manhal Health Spa — Al Ryan Branch',
  'سبا ومساج — الدمام، حي الريان.',
  'spa',
  'سبا ومساج',
  'الدمام',
  'المنطقة الشرقية',
  'حي الريان، الدمام',
  26.4720,
  50.0650,
  '0554321098',
  '0554321098',
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.38::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الهفوف' LIMIT 1),
  'سبا قصر لوزان النسائي',
  'Lausanne Palace Ladies Spa',
  'سبا للسيدات — الأحساء، الهفوف.',
  'spa',
  'سبا ومساج',
  'الهفوف',
  'المنطقة الشرقية',
  'الهفوف، الأحساء',
  25.3700,
  49.5750,
  '0135866221',
  '0135866221',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
-- ━━━ صالونات تجميل / أظافر ━━━
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مركز أظافر ديور (فرع الزهور)',
  'Dior Nails Center — Al Zahur',
  'أظافر وعناية — الدمام، حي الزهور.',
  'salon',
  'صالونات أظافر',
  'الدمام',
  'المنطقة الشرقية',
  'حي الزهور، الدمام',
  26.4340,
  50.0680,
  '0533334455',
  '0533334455',
  'https://images.unsplash.com/photo-1610992015732-2444b2e4c859?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1610992015732-2444b2e4c859?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.36::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'سيهات' LIMIT 1),
  'مشغل لمسة مخملية (فرع النمر)',
  'Velvet Touch Salon — Al Namir',
  'صالون نسائي — سيهات، حي النمر.',
  'salon',
  'صالونات تجميل نسائية',
  'سيهات',
  'المنطقة الشرقية',
  'حي النمر، سيهات',
  26.4880,
  50.0280,
  '0566771122',
  '0566771122',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.33::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'حفر الباطن' LIMIT 1),
  'مشغل كليوباترا النسائي',
  'Cleopatra Ladies Salon',
  'تجميل نسائي — حفر الباطن، حي الربوة.',
  'salon',
  'صالونات تجميل نسائية',
  'حفر الباطن',
  'المنطقة الشرقية',
  'حي الربوة، حفر الباطن',
  28.4300,
  45.9580,
  '0501199882',
  '0501199882',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.3::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'عنك' LIMIT 1),
  'مشغل ريميه النسائي',
  'Reemeh Ladies Salon',
  'مشغل نسائي — عنك.',
  'salon',
  'صالونات تجميل نسائية',
  'عنك',
  'المنطقة الشرقية',
  'عنك',
  26.5400,
  49.9900,
  '0501144773',
  '0501144773',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.28::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'تاروت' LIMIT 1),
  'صالون جارة القمر',
  'Jarat Al Qamar Salon',
  'صالون نسائي — تاروت، حي تركيا.',
  'salon',
  'صالونات تجميل نسائية',
  'تاروت',
  'المنطقة الشرقية',
  'حي تركيا، تاروت',
  26.5760,
  50.0600,
  '0566332211',
  '0566332211',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.31::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'النعيرية' LIMIT 1),
  'مركز فوزية للتزيين النسائي',
  'Fawziya Women''s Styling Center',
  'تزيين نسائي — النعيرية.',
  'salon',
  'صالونات تجميل نسائية',
  'النعيرية',
  'المنطقة الشرقية',
  'النعيرية',
  27.4700,
  48.4880,
  '0566332211',
  '0566332211',
  'https://images.unsplash.com/photo-1629909615184-7ee455ee2a07?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1629909615184-7ee455ee2a07?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.32::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'النعيرية' LIMIT 1),
  'مشغل روعة الليل',
  'Raw''at Al Layl Salon',
  'مشغل نسائي — النعيرية، حي الروضة.',
  'salon',
  'صالونات تجميل نسائية',
  'النعيرية',
  'المنطقة الشرقية',
  'حي الروضة، النعيرية',
  27.4680,
  48.4850,
  '0501199223',
  '0501199223',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.29::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'النعيرية' LIMIT 1),
  'مركز لولوه للتجميل',
  'Lulwa Beauty Center',
  'تجميل نسائي — النعيرية، حي الربوة.',
  'salon',
  'صالونات تجميل نسائية',
  'النعيرية',
  'المنطقة الشرقية',
  'حي الربوة، النعيرية',
  27.4690,
  48.4860,
  '0533221199',
  '0533221199',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.34::numeric, 0, 0, 'moderate', true, false, false, 'manual'
);

COMMIT;
