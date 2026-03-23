-- ROSERA — Manual seed Batch 15 (women-only, Riyadh — شرق/شمال شرق: الروضة، النهضة، الريان، اليرموك، الخليج، السلام).
-- القائمة المُرسل كانت ~17 سطراً (ليس 60). بعد التدقيق مقابل manual_batch_02–11 + 13/14: **4 صفوف** فريدة.
-- المنطقة: `منطقة الرياض`. city_id عبر `sa_cities.name_ar = 'الرياض'`.
--
-- SKIPPED_DUPLICATES:
--   920004411 عيادات رام — رقم وطني مكرر (دفعات 08/09/11)
--   0138496666 عيادات أدفانسد تاتش — batch 07 (علامة + نفس الرقم)
--   0138095911 مجمع دار عافية — batch 09 (الدمام، نفس الرقم المركزي)
--   0112491122 مشغل شيفون — مكرر مع **نفس** سطر `مجمع عيادات الروضة` في اللصق (هاتف واحد لاثنين؛ أُدرج المجمع الطبي فقط)
--   0544331122 صالون ملكة الليل — batches 06/09
--   0555443322 لمسة الكادي — سلسلة دفعات 06/10
--   0566771122 ريتاج للزفاف — batches 07/08
--   0533221155 هدوء المساج — batch 10 (الخبر) نفس الرقم
--   0544771122 لافندر — سلسلة دفعات 04–09
--   0500112233 مساج الندى — batches 06/09
--   0544331155 لولو — سلسلة أظافر لولو 02–10
--   0533229988 نيل بار — batches 06/09
--   0544119944 لومير — batch 08
--
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
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الرياض' LIMIT 1),
  'مجمع عيادات الروضة الطبي (قسم الجلدية النسائي — الرياض)',
  'Al Rawdah Medical Complex — Women''s Dermatology (Riyadh)',
  'قسم جلدية نسائي — الرياض، حي الروضة. (اسم مشابه لمجمع الشرقية برقم مختلف؛ هذا فرع/موقع الرياض.)',
  'clinic',
  'عيادات جلدية وتجميل نسائية',
  'الرياض',
  'منطقة الرياض',
  'حي الروضة، الرياض',
  24.7680,
  46.7940,
  '0112491122',
  '0112491122',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.47::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الرياض' LIMIT 1),
  'مركز مجمع الخليج الطبي (نسائي — الرياض)',
  'Al Khalij Medical Complex — Women''s Section',
  'خدمات طبية بتركيز نسائي — الرياض، حي الخليج.',
  'clinic',
  'مجمعات طبية نسائية',
  'الرياض',
  'منطقة الرياض',
  'حي الخليج، الرياض',
  24.8200,
  46.7280,
  '0112272222',
  '0112272222',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80'],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"21:00"},"الجمعة":{"open":"16:00","close":"21:00"}}'::jsonb,
  4.46::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الرياض' LIMIT 1),
  'مركز مشغل أضواء الشرق للعرائس (حي النهضة)',
  'Adwa'' Ash Sharq Bridal Studio — Al Nahdah',
  'تجهيز عرائس — نسائي فقط — الرياض، حي النهضة.',
  'salon',
  'صالونات عرائس',
  'الرياض',
  'منطقة الرياض',
  'حي النهضة، الرياض',
  24.7750,
  46.8120,
  '0112261133',
  '0112261133',
  'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.44::numeric, 0, 0, 'upscale', true, false, false, 'manual'
),
(
  (SELECT id FROM public.sa_cities WHERE name_ar = 'الرياض' LIMIT 1),
  'مشغل دار نورة النسائي (فرع الرياض — حي السلام)',
  'Dar Noura Ladies Salon — Riyadh Al Salam Branch',
  'صالون نسائي — الرياض، حي السلام (هاتف منفصل عن فروع المنطقة الشرقية في الدفعات السابقة).',
  'salon',
  'صالونات تجميل نسائية',
  'الرياض',
  'منطقة الرياض',
  'حي السلام، الرياض',
  24.9580,
  46.8680,
  '0112353311',
  '0112353311',
  'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
  ARRAY['https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'],
  '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
  4.35::numeric, 0, 0, 'moderate', true, false, false, 'manual'
);

COMMIT;
