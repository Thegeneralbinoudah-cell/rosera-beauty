-- Sample data: 3 salons (businesses), categories, 5 services + 3 staff each.
-- Idempotent: skips if seed businesses already exist.

DO $$
DECLARE
  v_b1 uuid := 'a1111111-1111-4111-8111-111111111101';
  v_b2 uuid := 'a2222222-2222-4222-8222-222222222202';
  v_b3 uuid := 'a3333333-3333-4333-8333-333333333303';
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = v_b1) INTO v_exists;
  IF v_exists THEN
    RAISE NOTICE '073_sample_salons_services_staff: seed already present, skip';
    RETURN;
  END IF;

  INSERT INTO public.businesses (
    id,
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
    is_active,
    is_demo,
    is_verified,
    source_type
  ) VALUES
  (
    v_b1,
    'لمسة حوراء — عرض تجريبي [CatalogSeed:v1]',
    'Hawra Touch — demo',
    'صالون نسائي تجريبي للاختبار.',
    'salon',
    'صالون نسائي',
    'الرياض',
    'منطقة الرياض',
    'حي العليا، الرياض',
    24.7136,
    46.6753,
    '0500000001',
    '0500000001',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
    ARRAY[
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80'
    ],
    '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
    4.6,
    42,
    true,
    false,
    false,
    'manual'
  ),
  (
    v_b2,
    'روز للجمال — عرض تجريبي [CatalogSeed:v1]',
    'Rose Beauty — demo',
    'مركز تجميل تجريبي.',
    'beauty_center',
    'مركز تجميل',
    'جدة',
    'منطقة مكة المكرمة',
    'حي الزهراء، جدة',
    21.5433,
    39.1728,
    '0500000002',
    '0500000002',
    'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
    ARRAY[
      'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
      'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d5?w=800&q=80'
    ],
    '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
    4.8,
    28,
    true,
    false,
    false,
    'manual'
  ),
  (
    v_b3,
    'لمسة أناقة — عرض تجريبي [CatalogSeed:v1]',
    'Elegance Touch — demo',
    'سبا ومساج تجريبي.',
    'spa',
    'سبا ومساج',
    'الخبر',
    'المنطقة الشرقية',
    'حي الراكة، الخبر',
    26.2172,
    50.1971,
    '0500000003',
    '0500000003',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
    ARRAY[
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80'
    ],
    '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb,
    4.5,
    19,
    true,
    false,
    false,
    'manual'
  );

  -- Categories per salon (3 each): services will reference category_id
  INSERT INTO public.service_categories (id, salon_id, name, name_ar, icon, sort_order) VALUES
  ('b1111111-1111-4111-8111-111111111101', v_b1, 'Hair', 'الشعر', 'scissors', 0),
  ('b1111111-1111-4111-8111-111111111102', v_b1, 'Nails', 'الأظافر', 'sparkles', 1),
  ('b1111111-1111-4111-8111-111111111103', v_b1, 'Skin', 'البشرة', 'heart', 2),
  ('b2222222-2222-4222-8222-222222222201', v_b2, 'Hair', 'الشعر', 'scissors', 0),
  ('b2222222-2222-4222-8222-222222222202', v_b2, 'Makeup', 'المكياج', 'palette', 1),
  ('b2222222-2222-4222-8222-222222222203', v_b2, 'Bridal', 'العرائس', 'crown', 2),
  ('b3333333-3333-4333-8333-333333333301', v_b3, 'Massage', 'المساج', 'hand', 0),
  ('b3333333-3333-4333-8333-333333333302', v_b3, 'Skin', 'البشرة', 'heart', 1),
  ('b3333333-3333-4333-8333-333333333303', v_b3, 'Hair', 'الشعر', 'scissors', 2);

  -- 5 services per salon: business_id = salon, category_id set
  INSERT INTO public.services (
    id,
    business_id,
    category_id,
    name_ar,
    name_en,
    category,
    price,
    duration_minutes,
    price_from,
    price_to,
    is_active,
    is_demo,
    source_type
  ) VALUES
  -- Salon 1
  ('c1111111-1111-4111-8111-111111111101', v_b1, 'b1111111-1111-4111-8111-111111111101', 'قص وتصفيف', 'Cut & style', 'hair', 120.00, 45, 120.00, 120.00, true, false, 'manual'),
  ('c1111111-1111-4111-8111-111111111102', v_b1, 'b1111111-1111-4111-8111-111111111101', 'صبغة كاملة', 'Full color', 'hair', 280.00, 120, 250.00, 320.00, true, false, 'manual'),
  ('c1111111-1111-4111-8111-111111111103', v_b1, 'b1111111-1111-4111-8111-111111111102', 'مانيكير', 'Manicure', 'nails', 90.00, 40, 90.00, 90.00, true, false, 'manual'),
  ('c1111111-1111-4111-8111-111111111104', v_b1, 'b1111111-1111-4111-8111-111111111102', 'بديكير', 'Pedicure', 'nails', 110.00, 50, 110.00, 110.00, true, false, 'manual'),
  ('c1111111-1111-4111-8111-111111111105', v_b1, 'b1111111-1111-4111-8111-111111111103', 'تنظيف بشرة', 'Facial cleanse', 'skin', 200.00, 60, 180.00, 220.00, true, false, 'manual'),
  -- Salon 2
  ('c2222222-2222-4222-8222-222222222201', v_b2, 'b2222222-2222-4222-8222-222222222201', 'قص شعر', 'Haircut', 'hair', 100.00, 40, 100.00, 100.00, true, false, 'manual'),
  ('c2222222-2222-4222-8222-222222222202', v_b2, 'b2222222-2222-4222-8222-222222222202', 'مكياج نهاري', 'Day makeup', 'makeup', 150.00, 50, 150.00, 150.00, true, false, 'manual'),
  ('c2222222-2222-4222-8222-222222222203', v_b2, 'b2222222-2222-4222-8222-222222222202', 'مكياج سهرة', 'Evening makeup', 'makeup', 220.00, 60, 220.00, 220.00, true, false, 'manual'),
  ('c2222222-2222-4222-8222-222222222204', v_b2, 'b2222222-2222-4222-8222-222222222203', 'تجربة عروس', 'Bridal trial', 'bridal', 450.00, 90, 400.00, 500.00, true, false, 'manual'),
  ('c2222222-2222-4222-8222-222222222205', v_b2, 'b2222222-2222-4222-8222-222222222201', 'استشارة شعر', 'Hair consult', 'hair', 0.00, 20, 0.00, 0.00, true, false, 'manual'),
  -- Salon 3
  ('c3333333-3333-4333-8333-333333333301', v_b3, 'b3333333-3333-4333-8333-333333333301', 'مساج استرخاء', 'Relaxation massage', 'massage', 180.00, 60, 160.00, 200.00, true, false, 'manual'),
  ('c3333333-3333-4333-8333-333333333302', v_b3, 'b3333333-3333-4333-8333-333333333301', 'مساج كتفين', 'Shoulder massage', 'massage', 120.00, 30, 120.00, 120.00, true, false, 'manual'),
  ('c3333333-3333-4333-8333-333333333303', v_b3, 'b3333333-3333-4333-8333-333333333302', 'قناع ترطيب', 'Hydrating mask', 'skin', 140.00, 45, 140.00, 140.00, true, false, 'manual'),
  ('c3333333-3333-4333-8333-333333333304', v_b3, 'b3333333-3333-4333-8333-333333333303', 'تصفيف سريع', 'Blowout', 'hair', 85.00, 35, 85.00, 85.00, true, false, 'manual'),
  ('c3333333-3333-4333-8333-333333333305', v_b3, 'b3333333-3333-4333-8333-333333333302', 'تقشير لطيف', 'Gentle peel', 'skin', 170.00, 40, 170.00, 170.00, true, false, 'manual');

  INSERT INTO public.staff (id, salon_id, name, name_ar, specialty, specialty_ar, rating, image_url, sort_order) VALUES
  ('d1111111-1111-4111-8111-111111111101', v_b1, 'Sara A.', 'سارة العتيبي', 'Hair stylist', 'مصففة شعر', 4.9, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80', 0),
  ('d1111111-1111-4111-8111-111111111102', v_b1, 'Nour K.', 'نور الخالد', 'Nail artist', 'فنانة أظافر', 4.8, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80', 1),
  ('d1111111-1111-4111-8111-111111111103', v_b1, 'Layla M.', 'ليلى المطيري', 'Esthetician', 'أخصائية بشرة', 4.7, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80', 2),
  ('d2222222-2222-4222-8222-222222222201', v_b2, 'Huda S.', 'هدى السبيعي', 'Makeup artist', 'خبيرة مكياج', 5.0, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80', 0),
  ('d2222222-2222-4222-8222-222222222202', v_b2, 'Reem F.', 'ريم الفهد', 'Bridal specialist', 'أخصائية عرائس', 4.9, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&q=80', 1),
  ('d2222222-2222-4222-8222-222222222203', v_b2, 'Maha R.', 'مها الراشد', 'Hair designer', 'مصممة شعر', 4.6, 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80', 2),
  ('d3333333-3333-4333-8333-333333333301', v_b3, 'Dina H.', 'دينا الحربي', 'Massage therapist', 'أخصائية مساج', 4.8, 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80', 0),
  ('d3333333-3333-4333-8333-333333333302', v_b3, 'Amal T.', 'أمل الثقفي', 'Spa therapist', 'معالجة سبا', 4.7, 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=200&q=80', 1),
  ('d3333333-3333-4333-8333-333333333303', v_b3, 'Hanan Q.', 'حنان القحطاني', 'Skin care', 'عناية بالبشرة', 4.9, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80', 2);

  RAISE NOTICE '073_sample_salons_services_staff: inserted 3 businesses, 9 categories, 15 services, 9 staff';
END $$;
