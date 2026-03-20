-- ROSERA — Manual seed Batch 9 (women-only, Eastern Province).
-- The paste was ~26 lines (not 80). Cross-checked phones/names vs `manual_batch_02`–`08`: **4 unique inserts** below.
--
-- SKIPPED_DUPLICATES (same phone already in manual seeds; see also batch 07/08 headers):
--   920001188 عيادات المانع الجبيل — batches 03/04
--   0138080808 جوفا / فرع السيدات — batch 05 `عيادات جوفا` (الدمام الشاطئ)
--   920000032 مركز النخبة الليزر — batch 05 `مركز النخبة الطبي` الخبر
--   920004411 عيادات رام القطيف — batch 08 `عيادات رام` الجبيل (نفس الرقم الوطني)
--   0544119933 لمسة إبداع عرائس — batches 06/07 (نفس الرقم مع صفوف أخرى)
--   0566332211 ليلة العمر الهفوف — batches 04/06/07
--   0133411000 فوزية/مذهلة الجبيل — batch 02 spa الفناتير + قوائم سابقة
--   0544112288 دار نورة المبرز — batches 05/06
--   0501199334 ملكة جمال تاروت — batch 04
--   0500112233 مساج الندى الخبر — batch 06 `مركز مساج الندى النسائي`
--   0500667788 هيربل الفيصلية — batch 05 `سبا ومركز مساج هيربل`
--   0533441100 ريلاكس جبيل بلد — batch 06 `مركز ريلاكس سبا النسائي` الخبر
--   0135866221 لوزان الروضة — batch 07 `سبا قصر لوزان النسائي` الهفوف
--   0544778811 لافندر مساج الظهران — batches 06/07
--   0138991144 تيب آند تو — batch 02
--   0533229988 نيل بار الهدا — batch 06
--   0544331122 أظافر لولو الدمام — batch 06 `صالون ملكة الليل للعرائس` سيهات
--   0504953321 دانة النعيرية — batch 06
--   0544998811 قرية العليا — batches 05/06
--   0501188334 زهرة الخفجي — batch 03 `صالون زهرة الخفجي`
--   0544119922 نجمة بقيق — batch 08
--   0566443322 ريتاج المحمدية — batch 06
--   0501199221 لمسة الجمال سلوى — batch 08 `صالون لمسة الجمال`
--   0501122334 فتون البطحاء — batches 05/08 (مذكور كـ SKIP في 08)
--   0544119944 لومير سيهات — batch 08 `مركز لومير للعناية بالشعر`
--
-- Coordinates: district-level approximations for Eastern Province (verify in Maps for production).
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
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مجمع عيادات الروضة العام (قسم الجلدية والتجميل النسائي)',
  'Al Rawdah General Complex — Women''s Dermatology & Aesthetics',
  'جلدية وتجميل نسائي — الدمام، حي الطبيشي. دفعة 9.',
  'clinic',
  'عيادات جلدية وتجميل',
  'الدمام',
  'المنطقة الشرقية',
  'حي الطبيشي، الدمام',
  26.3982,
  50.0518,
  '0138346555',
  '0138346555',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.48::numeric,
  0,
  0,
  'upscale',
  true,
  false,
  false,
  'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'عيادات د. ليلى العنيزي (صحة المرأة)',
  'Dr. Layla Alenezi Clinics — Women''s Health',
  'متابعة صحة المرأة — الخبر، حي العقربية.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الخبر',
  'المنطقة الشرقية',
  'حي العقربية، الخبر',
  26.2934,
  50.2186,
  '0138946661',
  '0138946661',
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.49::numeric,
  0,
  0,
  'upscale',
  true,
  false,
  false,
  'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الدمام' LIMIT 1),
  'مجمع عيادات دار عافية (قسم النساء)',
  'Dar Afiya Clinics — Women''s Section',
  'مجمع طبي قسم نسائي — الدمام، حي المباركية.',
  'clinic',
  'عيادات عناية بصحة المرأة',
  'الدمام',
  'المنطقة الشرقية',
  'حي المباركية، الدمام',
  26.4279,
  50.0914,
  '0138095911',
  '0138095911',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric,
  0,
  0,
  'upscale',
  true,
  false,
  false,
  'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الخبر' LIMIT 1),
  'مشغل قصر الملكة (فرع حي الحزام)',
  'Queen Palace Salon — Al Hizam Branch',
  'تجهيز عرائس — الخبر، حي الحزام (رقم هاتف مختلف عن فرع الراكة في دفعة 6).',
  'salon',
  'صالونات عرائس',
  'الخبر',
  'المنطقة الشرقية',
  'حي الحزام، الخبر',
  26.2686,
  50.1912,
  '0544881122',
  '0544881122',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.51::numeric,
  0,
  0,
  'upscale',
  true,
  false,
  false,
  'manual'
);

COMMIT;
