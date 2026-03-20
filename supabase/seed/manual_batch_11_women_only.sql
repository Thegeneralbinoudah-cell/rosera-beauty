-- ROSERA — Manual seed Batch 11 (women-only, Eastern Province).
-- Paste was ~45 lines (not 100). Cross-checked phones + Arabic trade / brand names vs `manual_batch_02`–`10`: **10 unique inserts** below.
--
-- SKIPPED_DUPLICATES (phone already seeded, national clinic line, adjacent number to same complex, or same brand as earlier batches):
--   0133415511 عيادات تالين الجبيل — batches 06/07 `عيادات تالين الطبية`
--   0138496677 عيادات أدفانسد تاتش اليرموك — batch 07 `عيادات أدفانسد تاتش` + batch 10 (علامة تجارية)
--   920004411 عيادات رام — batch 08 (رقم وطني موحّد لسلسلة رام)
--   0138346556 مجمع عيادات الروضة — batch 09 `مجمع عيادات الروضة العام` بنفس المجمع ورقم ملاصق 0138346555
--   0137215501 عيادة لافندر حفر الباطن — batches 04/06/07/08 سلسلة `لافندر`
--   مركز ليلة زفافي، مشغل دار الهنوف، مركز مذهلة، صالون ملكة الليل، مركز سندريلا، مشغل لمسة الكادي، أتيليه روعة الزفاف — نفس أسماء/سلاسل دفعات 02–08
--   0544771124 سبا لافندر الخبر — سلسلة `لافندر` (06/07/09)
--   0135866223 سبا قصر لوزان — batches 07/09/10 علامة `قصر لوزان`
--   0500112267 مركز مساج الندى — batches 03/06/10 علامة `مساج الندى`
--   مركز تيب آند تو، صالون نيل بار، مركز أظافر لولو — batches 02/06/09/10
--   0544331123 أظافر لولو — رقم ملاصق 0544331122 مع نفس سلسلة لولو/ملكة الليل (دفعة 06/09)
--   مشغل دانة النعيرية، مركز تجميل قرية العليا، صالون زهرة الخفجي، صالون نجمة بقيق، مشغل ريتاج النسائي، صالون لمسة الجمال سلوى، مشغل فتون البطحاء، مركز لومير رأس تنورة، صالون دار ريتاج تاروت، مشغل لمسات وردية صفوى — أسماء سلاسل مذكورة في 03–10 (أرقام متاخمة فقط)
--   0501199223 صالون لمسة الجمال سلوى — batch 07 `مشغل روعة الليل` النعيرية (نفس الرقم)
--   0566332212 مشغل جارة القمر تاروت — batch 07 `صالون جارة القمر` (نفس العلامة؛ رقم ملاصق 0566332211)
--   0501144774 مشغل ريميه عنك — batch 07 `مشغل ريميه النسائي` برقم ملاصق 0501144773
--   0566332256 صالون دار ريتاج تاروت — batch 08 `صالون دار ريتاج للتجميل`
--
-- Cities referenced in the paste (سلوى، البطحاء، قرية العليا، …) are already covered by idempotent inserts in batches 04/07/08; هذا الملف لا يضيف صفوف أعمال فيها بعد الاستبعاد أعلاه.
--
-- Coordinates: district-level approximations — verify in Maps for production.
-- is_demo = false, source_type = 'manual'

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
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مركز الدكتور حسن العبدالله للجلدية (قسم السيدات)',
  'Dr. Hassan Al-Abdullah Dermatology Center — Ladies'' Section',
  'قسم سيدات فقط لعيادة الجلدية والتجميل — الخبر، حي العليا.',
  'clinic',
  'عيادات جلدية وتجميل نسائية',
  'الخبر',
  'المنطقة الشرقية',
  'حي العليا، الخبر',
  26.3050,
  50.2020,
  '0138870000',
  '0138870000',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'عيادات الجودة الطبية (جلدية وليزر نسائي)',
  'Al Joudah Medical Clinics — Women''s Dermatology & Laser',
  'عيادات جلدية وليزر بقسم نسائي — الدمام، حي المنار.',
  'clinic',
  'عيادات ليزر وطب تجميل نسائي',
  'الدمام',
  'المنطقة الشرقية',
  'حي المنار، الدمام',
  26.4520,
  50.0620,
  '0138112244',
  '0138112244',
  'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.46::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مجمع عيادات دار عافية (فرع الخبر — حي الحزام الذهبي)',
  'Dar Afiya Medical Complex — Al Khobar Branch',
  'مجمع طبي يخدم السيدات في أغلب العيادات — الخبر، الحزام الذهبي (هاتف مختلف عن فرع الدمام في الدفعة 9).',
  'clinic',
  'مجمعات طبية نسائية',
  'الخبر',
  'المنطقة الشرقية',
  'حي الحزام الذهبي، الخبر',
  26.2750,
  50.1980,
  '0138095922',
  '0138095922',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'القطيف' LIMIT 1),
  'مركز العناية النسائية التخصصي',
  'Specialized Women''s Care Center',
  'رعاية نسائية متخصصة ببيئة نسائية بالكامل — القطيف، حي الناصرة.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'القطيف',
  'المنطقة الشرقية',
  'حي الناصرة، القطيف',
  26.5690,
  49.9890,
  '0544778855',
  '0544778855',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.45::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخفجي' LIMIT 1),
  'مركز بسمة المرأة الطبي (فرع الخفجي — حي العزيزية)',
  'Bassmat Al Mar''a Medical Center',
  'نقطة رعاية صحية ونسائية — الخفجي، حي العزيزية.',
  'clinic',
  'مراكز طبية نسائية',
  'الخفجي',
  'المنطقة الشرقية',
  'حي العزيزية، الخفجي',
  28.9050,
  48.5350,
  '0544223367',
  '0544223367',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.44::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مركز هدوء المساج (نسائي)',
  'Hodoo Massage Center — Women Only',
  'مساج واسترخاء في جناح سيدات فقط — الدمام، حي أحد.',
  'spa',
  'مراكز مساج واسترخاء نسائية',
  'الدمام',
  'المنطقة الشرقية',
  'حي أحد، الدمام',
  26.3920,
  50.0480,
  '0533221156',
  '0533221156',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"23:00"},"الأحد":{"open":"10:00","close":"23:00"},"الاثنين":{"open":"10:00","close":"23:00"},"الثلاثاء":{"open":"10:00","close":"23:00"},"الأربعاء":{"open":"10:00","close":"23:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"23:00"}}'::jsonb,
  4.42::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الظهران' LIMIT 1),
  'سبا فندق راديسون بلو الظهران (قسم السيدات)',
  'Radisson Blu Dhahran — Ladies'' Spa',
  'سبا فندقي بقسم سيدات — الظهران.',
  'spa',
  'سبا فندقي نسائي',
  'الظهران',
  'المنطقة الشرقية',
  'فندق راديسون بلو، الظهران',
  26.3040,
  50.1030,
  '0138750001',
  '0138750001',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"22:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.50::numeric, 0, 0, 'luxury', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مركز تداوي للسبا (نسائي)',
  'Tadawi Spa Center — Women Only',
  'سبا وعلاجات للسيدات فقط — الدمام، حي العزيزية.',
  'spa',
  'سبا وعلاجات نسائية',
  'الدمام',
  'المنطقة الشرقية',
  'حي العزيزية، الدمام',
  26.4410,
  50.0820,
  '0138339412',
  '0138339412',
  'https://images.unsplash.com/photo-1600334129128-0c9b141299f9?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1600334129128-0c9b141299f9?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"22:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.41::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'عنك' LIMIT 1),
  'صالون الأناقة والجمال (نسائي)',
  'Al Anaqah Wal Jamal Ladies Salon',
  'صالون تجميل وعناية للسيدات فقط — عنك، شارع الخيل.',
  'salon',
  'صالونات تجميل وتصفيف نسائية',
  'عنك',
  'المنطقة الشرقية',
  'شارع الخيل، عنك',
  26.5380,
  49.9880,
  '0566442212',
  '0566442212',
  'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.30::numeric, 0, 0, 'moderate', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'صفوى' LIMIT 1),
  'مركز صفوى للتزيين (نسائي)',
  'Safwa Women''s Styling Center',
  'تزيين وعناية بالشعر للسيدات فقط — صفوى، حي الصفا.',
  'salon',
  'مراكز تزيين وعناية بالشعر نسائية',
  'صفوى',
  'المنطقة الشرقية',
  'حي الصفا، صفوى',
  26.7060,
  49.9480,
  '0500112245',
  '0500112245',
  'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.32::numeric, 0, 0, 'moderate', true, false, false, 'manual'
);

COMMIT;
