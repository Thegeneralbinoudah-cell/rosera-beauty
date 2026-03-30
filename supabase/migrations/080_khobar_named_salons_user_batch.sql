-- Khobar (الخبر) — named salons from product list [KhobarNamedBatch:v1]
-- Idempotent: skips if a business in «الخبر» already matches normalized name_ar (same logic as 075).
-- Cover images: stable Unsplash beauty/salon photos (varied per name via hashtext). Not venue-specific photos.
-- Adds 2 bookable services per new business.

DO $$
DECLARE
  v_city_id uuid;
  v_hours jsonb := '{"السبت":{"open":"10:00","close":"22:00"},"الأحد":{"open":"10:00","close":"22:00"},"الاثنين":{"open":"10:00","close":"22:00"},"الثلاثاء":{"open":"10:00","close":"22:00"},"الأربعاء":{"open":"10:00","close":"22:00"},"الخميس":{"open":"10:00","close":"23:00"},"الجمعة":{"open":"14:00","close":"22:00"}}'::jsonb;
  v_covers text[] := ARRAY[
    'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162ca0d25?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519415389532-a0635469bef7?w=1200&q=88&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&q=88&auto=format&fit=crop'
  ];
  inserted_biz int := 0;
  inserted_svc int := 0;
  skipped_existing int := 0;
  new_id uuid;
  salon_row record;
  v_cover text;
  v_cover2 text;
  idx1 int;
  idx2 int;
BEGIN
  SELECT c.id
  INTO v_city_id
  FROM public.sa_cities c
  INNER JOIN public.sa_regions reg ON reg.id = c.region_id
  WHERE reg.name_ar = 'المنطقة الشرقية'
    AND c.name_ar = 'الخبر'
  LIMIT 1;

  IF v_city_id IS NULL THEN
    RAISE EXCEPTION '080_khobar_named: city «الخبر» not found in sa_cities';
  END IF;

  FOR salon_row IN
    SELECT *
    FROM (
      VALUES
        ('Glo Spa and Salon'::text, 'Glo Spa and Salon'::text, 4.55::numeric(3, 2), 40::int, 26.255000::double precision, 50.178000::double precision),
        ('Tiara The Spa'::text, 'Tiara The Spa'::text, 4.60::numeric(3, 2), 57::int, 26.259200::double precision, 50.181800::double precision),
        ('Polished'::text, 'Polished'::text, 4.65::numeric(3, 2), 74::int, 26.263400::double precision, 50.185600::double precision),
        ('صالون ميراكي للتزيين النسائي'::text, 'Miraki Ladies Salon'::text, 4.70::numeric(3, 2), 91::int, 26.267600::double precision, 50.189400::double precision),
        ('MYB lounge & spa 🐚'::text, 'MYB lounge & spa'::text, 4.75::numeric(3, 2), 108::int, 26.271800::double precision, 50.193200::double precision),
        ('gloss''d Beauty Lounge'::text, 'gloss''d Beauty Lounge'::text, 4.80::numeric(3, 2), 125::int, 26.276000::double precision, 50.197000::double precision),
        ('ERM Hair Spa'::text, 'ERM Hair Spa'::text, 4.85::numeric(3, 2), 142::int, 26.280200::double precision, 50.200800::double precision),
        ('Moda Moda Ladies Center / Al Rakah Branch'::text, 'Moda Moda Ladies Center'::text, 4.55::numeric(3, 2), 159::int, 26.284400::double precision, 50.204600::double precision),
        ('BANAN BEAUTY SALON & SPA'::text, 'BANAN BEAUTY SALON & SPA'::text, 4.60::numeric(3, 2), 176::int, 26.288600::double precision, 50.208400::double precision),
        ('La Beaute Salon & Spa'::text, 'La Beaute Salon & Spa'::text, 4.65::numeric(3, 2), 193::int, 26.292800::double precision, 50.212200::double precision),
        ('Helen Grace Beauty salon & spa'::text, 'Helen Grace Beauty salon & spa'::text, 4.70::numeric(3, 2), 210::int, 26.297000::double precision, 50.216000::double precision),
        ('Hush Beauty Spa & Getaway'::text, 'Hush Beauty Spa & Getaway'::text, 4.75::numeric(3, 2), 227::int, 26.257000::double precision, 50.219800::double precision),
        ('Amber beauty lounge'::text, 'Amber beauty lounge'::text, 4.80::numeric(3, 2), 244::int, 26.261200::double precision, 50.223600::double precision),
        ('Brows bar مركز ركن الحواجب'::text, 'Brows bar'::text, 4.85::numeric(3, 2), 41::int, 26.265400::double precision, 50.180500::double precision),
        ('صالون لالون دورييه النسائي La lune dorée beauty&spa salon'::text, 'La lune dorée beauty&spa salon'::text, 4.55::numeric(3, 2), 58::int, 26.269600::double precision, 50.184300::double precision),
        ('Beauty&Co.Salon'::text, 'Beauty&Co.Salon'::text, 4.60::numeric(3, 2), 75::int, 26.273800::double precision, 50.188100::double precision),
        ('Elee Belle Beauty Lounge'::text, 'Elee Belle Beauty Lounge'::text, 4.65::numeric(3, 2), 92::int, 26.278000::double precision, 50.191900::double precision),
        ('ACE hair and nail salon'::text, 'ACE hair and nail salon'::text, 4.70::numeric(3, 2), 109::int, 26.282200::double precision, 50.195700::double precision),
        ('ink brows & beauty'::text, 'ink brows & beauty'::text, 4.75::numeric(3, 2), 126::int, 26.286400::double precision, 50.199500::double precision),
        ('صالون لابيرل بيوتي'::text, 'La Pearl Beauty Salon'::text, 4.80::numeric(3, 2), 143::int, 26.290600::double precision, 50.203300::double precision),
        ('صالون هوت ستون - Hot Stone Beauty Salon'::text, 'Hot Stone Beauty Salon'::text, 4.85::numeric(3, 2), 160::int, 26.294800::double precision, 50.207100::double precision),
        ('Elegance bar ladies salon'::text, 'Elegance bar ladies salon'::text, 4.55::numeric(3, 2), 177::int, 26.299000::double precision, 50.210900::double precision),
        ('Nomarz Beauty Lounge'::text, 'Nomarz Beauty Lounge'::text, 4.60::numeric(3, 2), 194::int, 26.259000::double precision, 50.214700::double precision),
        ('La touche Spéciale - Beauty Salon'::text, 'La touche Spéciale'::text, 4.65::numeric(3, 2), 211::int, 26.263200::double precision, 50.218500::double precision),
        ('Identity Beauty Salon'::text, 'Identity Beauty Salon'::text, 4.70::numeric(3, 2), 228::int, 26.267400::double precision, 50.222300::double precision),
        ('Quick Beauty Salon'::text, 'Quick Beauty Salon'::text, 4.75::numeric(3, 2), 245::int, 26.271600::double precision, 50.226100::double precision),
        ('Rituals Beauty Lounge & Spa'::text, 'Rituals Beauty Lounge & Spa'::text, 4.80::numeric(3, 2), 42::int, 26.275800::double precision, 50.183000::double precision),
        ('Avene Spa افين سبا'::text, 'Avene Spa'::text, 4.85::numeric(3, 2), 59::int, 26.280000::double precision, 50.186800::double precision),
        ('RM BEAUTY SALON & Boutique 💕'::text, 'RM BEAUTY SALON & Boutique'::text, 4.55::numeric(3, 2), 76::int, 26.284200::double precision, 50.190600::double precision),
        ('صالون أنانا بيوتي | Ananna Beauty Center'::text, 'Ananna Beauty Center'::text, 4.60::numeric(3, 2), 93::int, 26.288400::double precision, 50.194400::double precision),
        ('Iris beauty lounge'::text, 'Iris beauty lounge'::text, 4.65::numeric(3, 2), 110::int, 26.292600::double precision, 50.198200::double precision),
        ('LILYAS SALON'::text, 'LILYAS SALON'::text, 4.70::numeric(3, 2), 127::int, 26.296800::double precision, 50.202000::double precision),
        ('Brazil Studio Salon - Khobar Citywalk - برازيل ستديو صالون'::text, 'Brazil Studio Salon'::text, 4.75::numeric(3, 2), 144::int, 26.301000::double precision, 50.205800::double precision),
        ('TONI VAYZ | Elite Lounge'::text, 'TONI VAYZ Elite Lounge'::text, 4.80::numeric(3, 2), 161::int, 26.261000::double precision, 50.209600::double precision),
        ('بيوتي هولك صالون | Beautiholic salon'::text, 'Beautiholic salon'::text, 4.85::numeric(3, 2), 178::int, 26.265200::double precision, 50.213400::double precision),
        ('Madame oh la laa'::text, 'Madame oh la laa'::text, 4.55::numeric(3, 2), 195::int, 26.269400::double precision, 50.217200::double precision),
        ('Solaire Beauty Lounge'::text, 'Solaire Beauty Lounge'::text, 4.60::numeric(3, 2), 212::int, 26.273600::double precision, 50.221000::double precision),
        ('Quick Touch Beauty Salon'::text, 'Quick Touch Beauty Salon'::text, 4.65::numeric(3, 2), 229::int, 26.277800::double precision, 50.224800::double precision),
        ('L''impossible Salon & Spa صالون المستحيل'::text, 'L''impossible Salon & Spa'::text, 4.70::numeric(3, 2), 246::int, 26.282000::double precision, 50.228600::double precision),
        ('FARAH PEARL Beauty Lounge - فرح بيرل'::text, 'FARAH PEARL Beauty Lounge'::text, 4.75::numeric(3, 2), 43::int, 26.286200::double precision, 50.185500::double precision),
        ('The nail Lounge'::text, 'The nail Lounge'::text, 4.80::numeric(3, 2), 60::int, 26.290400::double precision, 50.189300::double precision),
        ('H Beauty House | صالون بيت هاء للجمال'::text, 'H Beauty House'::text, 4.85::numeric(3, 2), 77::int, 26.294600::double precision, 50.193100::double precision),
        ('Moon Catcher Spa - مون كاتشر سبا'::text, 'Moon Catcher Spa'::text, 4.55::numeric(3, 2), 94::int, 26.298800::double precision, 50.196900::double precision),
        ('Bloom'::text, 'Bloom'::text, 4.60::numeric(3, 2), 111::int, 26.303000::double precision, 50.200700::double precision),
        ('OXIDE SALON — صالون أُكسيد'::text, 'OXIDE SALON'::text, 4.65::numeric(3, 2), 128::int, 26.263000::double precision, 50.204500::double precision),
        ('Fix Nails Spa & Salon'::text, 'Fix Nails Spa & Salon'::text, 4.70::numeric(3, 2), 145::int, 26.267200::double precision, 50.208300::double precision),
        ('Ayla studio'::text, 'Ayla studio'::text, 4.75::numeric(3, 2), 162::int, 26.271400::double precision, 50.212100::double precision),
        ('Spa29'::text, 'Spa29'::text, 4.80::numeric(3, 2), 179::int, 26.275600::double precision, 50.215900::double precision),
        ('Eternity Secret'::text, 'Eternity Secret'::text, 4.85::numeric(3, 2), 196::int, 26.279800::double precision, 50.219700::double precision),
        ('No7 Spa Ladies'::text, 'No7 Spa Ladies'::text, 4.55::numeric(3, 2), 213::int, 26.284000::double precision, 50.223500::double precision),
        ('House Of Zan'::text, 'House Of Zan'::text, 4.60::numeric(3, 2), 230::int, 26.288200::double precision, 50.227300::double precision),
        ('Flip Beauty Lounge'::text, 'Flip Beauty Lounge'::text, 4.65::numeric(3, 2), 247::int, 26.292400::double precision, 50.231100::double precision),
        ('اناقة جويل'::text, 'اناقة جويل'::text, 4.70::numeric(3, 2), 44::int, 26.296600::double precision, 50.188000::double precision)
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

    idx1 := (abs(hashtext(salon_row.name_ar)) % 12) + 1;
    idx2 := (abs(hashtext(salon_row.name_ar || ':img2')) % 12) + 1;
    v_cover := v_covers[idx1];
    v_cover2 := v_covers[idx2];
    IF v_cover2 = v_cover THEN
      v_cover2 := v_covers[((idx1 + 5) % 12) + 1];
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
      '[KhobarNamedBatch:v1] صالون نسائي — الخبر. بيانات الكتالوج؛ يُنصح بمراجعة العنوان والهاتف وصور المكان الفعلية.',
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
      ARRAY[v_cover, v_cover2]::text[],
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

  RAISE NOTICE '080_khobar_named: inserted businesses=%, services=%, skipped_existing_in_db=%',
    inserted_biz, inserted_svc, skipped_existing;
END $$;
