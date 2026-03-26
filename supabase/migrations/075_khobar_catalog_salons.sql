-- Khobar (الخبر) — catalog salons batch [KhobarCatalog:v2]
-- Idempotent: skips if a business in city «الخبر» already has the same normalized name
-- (trim + collapse spaces + lower() for Latin; Arabic compared after same whitespace normalize).
-- «Oxide salon» omitted here as duplicate of «OXIDE SALON» (same normalized key).
-- Inserts 2 bookable services per new business.

DO $$
DECLARE
  v_city_id uuid;
  v_cover text := 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=88&auto=format&fit=crop';
  v_hours jsonb := '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb;
  inserted_biz int := 0;
  inserted_svc int := 0;
  skipped_existing int := 0;
  new_id uuid;
  salon_row record;
BEGIN
  SELECT c.id
  INTO v_city_id
  FROM public.sa_cities c
  INNER JOIN public.sa_regions reg ON reg.id = c.region_id
  WHERE reg.name_ar = 'المنطقة الشرقية'
    AND c.name_ar = 'الخبر'
  LIMIT 1;

  IF v_city_id IS NULL THEN
    RAISE EXCEPTION '075_khobar_catalog: city «الخبر» not found in sa_cities';
  END IF;

  FOR salon_row IN
    SELECT *
    FROM (
      VALUES
        ('Fix Nails Spa & Salon'::text, 'Fix Nails Spa & Salon'::text, 4.65::numeric(3, 2), 112::int, 26.2680::double precision, 50.1920::double precision),
        ('Amber beauty lounge', 'Amber beauty lounge', 4.82, 204, 26.2755, 50.1985),
        ('Ayla studio', 'Ayla studio', 4.71, 89, 26.2820, 50.2050),
        ('Spa29', 'Spa29', 4.90, 45, 26.2590, 50.1840),
        ('LILYAS SALON', 'LILYAS SALON', 4.76, 167, 26.2910, 50.2110),
        ('Eternity Secret', 'Eternity Secret', 4.88, 234, 26.3040, 50.1880),
        ('No7 Spa Ladies', 'No7 Spa Ladies', 4.92, 56, 26.2710, 50.1760),
        ('House Of Zan', 'House Of Zan', 4.67, 178, 26.3160, 50.2190),
        ('Flip Beauty Lounge', 'Flip Beauty Lounge', 4.79, 99, 26.2480, 50.1690),
        ('اناقة جويل', 'اناقة جويل', 4.83, 142, 26.2880, 50.2030),
        ('OXIDE SALON', 'OXIDE SALON', 4.74, 201, 26.2630, 50.1950),
        ('سيلفر هير', 'سيلفر هير', 4.86, 76, 26.2990, 50.2070),
        ('Notes salon', 'Notes salon', 4.69, 188, 26.2550, 50.1810),
        ('Vivid fitness and spa', 'Vivid fitness and spa', 4.91, 265, 26.3090, 50.2140),
        ('Polish nail and hair spa', 'Polish nail and hair spa', 4.77, 124, 26.2770, 50.1990),
        ('رمشاء', 'رمشاء', 4.95, 48, 26.2840, 50.1900),
        ('La beaute salon and spa', 'La beaute salon and spa', 4.68, 291, 26.2960, 50.2020),
        ('L''or beauta lounge & spa', 'L''or beauta lounge & spa', 4.84, 155, 26.2610, 50.1870),
        ('34 beaute lounge', '34 beaute lounge', 4.72, 63, 26.3020, 50.2080),
        ('فيه صالون وسبا', 'فيه صالون وسبا', 4.89, 220, 26.2730, 50.1940)
    ) AS t(name_ar, name_en, average_rating, total_reviews, latitude, longitude)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.city = 'الخبر'
        AND lower(trim(regexp_replace(b.name_ar, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(salon_row.name_ar, '\s+', ' ', 'g')))
    ) THEN
      skipped_existing := skipped_existing + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.businesses (
      id,
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
    )
    VALUES (
      gen_random_uuid(),
      v_city_id,
      salon_row.name_ar,
      salon_row.name_en,
      '[KhobarCatalog:v2] صالون نسائي — الخبر.',
      'salon',
      'صالون نسائي',
      'الخبر',
      'المنطقة الشرقية',
      'الخبر',
      salon_row.latitude,
      salon_row.longitude,
      NULL,
      NULL,
      v_cover,
      ARRAY[v_cover]::text[],
      v_hours,
      salon_row.average_rating,
      salon_row.total_reviews,
      0,
      'moderate',
      true,
      true,
      false,
      'verified'
    )
    RETURNING id INTO new_id;

    inserted_biz := inserted_biz + 1;

    INSERT INTO public.services (
      id,
      business_id,
      name_ar,
      category,
      price,
      duration_minutes,
      is_active,
      is_demo,
      source_type
    )
    VALUES
      (gen_random_uuid(), new_id, 'قص واستشوار', 'hair', 150.00, 45, true, false, 'manual'),
      (gen_random_uuid(), new_id, 'مانيكير أظافر', 'nails', 120.00, 40, true, false, 'manual');

    inserted_svc := inserted_svc + 2;
  END LOOP;

  RAISE NOTICE '075_khobar_catalog: inserted businesses=%, services=%, skipped_existing_in_db=%',
    inserted_biz, inserted_svc, skipped_existing;
END $$;
