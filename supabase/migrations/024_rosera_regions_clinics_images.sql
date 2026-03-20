-- Rosera polish: region hero photos, remove male-barber labels, 3000 Eastern Province beauty clinics, unique cover URLs

BEGIN;

-- 1) Region images (Makkah aerial / Al Baha mountains — Unsplash)
UPDATE public.sa_regions
SET image_url = 'https://images.unsplash.com/photo-1541432901042-2d8bd68305c3?w=1200&q=80&auto=format&fit=crop'
WHERE id = '69f9b578-0a3b-4f08-b430-f2346a52686e';

UPDATE public.sa_regions
SET image_url = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80&auto=format&fit=crop'
WHERE id = '4f63b0ab-f4ea-4bcd-9d70-ca7d4cf20ba2';

-- 2) Replace male-oriented category labels (keep women’s beauty & clinics only)
UPDATE public.businesses
SET category_label = 'صالون نسائي'
WHERE category_label ILIKE '%حلاقة رج%'
   OR category_label ILIKE '%رجالي%';

-- 3) Idempotent: remove prior clinic seed
DELETE FROM public.services
WHERE business_id IN (SELECT id FROM public.businesses WHERE description_ar LIKE '%[RoseraClinic:v1]%');

DELETE FROM public.businesses
WHERE description_ar LIKE '%[RoseraClinic:v1]%';

-- 4) 3000 medical beauty clinics — Eastern Province focus (Khobar, Dammam, Al Ahsa, Jubail, Qatif, + Dhahran when present)
INSERT INTO public.businesses (
  id,
  city_id,
  name_ar,
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
SELECT
  gen_random_uuid(),
  c.city_id,
  'عيادة ' || (ARRAY['لمسات النور','إشراق البشرة','تألق الوجه','رونق الياسمين','دانة الخليج','سر الجمال','لآليء الشرق','واحة النضارة','بريق الأنوثة','أضواء الجمال'])[1 + ((s.i + c.ord * 3) % 10)]
    || ' — ' || c.city_name,
  'عيادة تجميل وعناية للسيدات في ' || c.city_name || '. [RoseraClinic:v1]',
  'clinic',
  lbl.category_label,
  c.city_name,
  'المنطقة الشرقية',
  'حي العليا، ' || c.city_name,
  c.clat + (random() - 0.5) * 0.07,
  c.clng + (random() - 0.5) * 0.07,
  '05' || lpad(((s.i * 7919 + c.ord * 97) % 90000000)::text, 8, '0'),
  '05' || lpad(((s.i * 4243 + c.ord * 131) % 90000000)::text, 8, '0'),
  format(
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80&clinic=%s',
    s.i::text
  ),
  ARRAY[
    format(
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80&clinic=%s',
      s.i::text
    )
  ],
  '{"السبت":{"open":"09:00","close":"21:00"},"الأحد":{"open":"09:00","close":"21:00"},"الاثنين":{"open":"09:00","close":"21:00"},"الثلاثاء":{"open":"09:00","close":"21:00"},"الأربعاء":{"open":"09:00","close":"21:00"},"الخميس":{"open":"09:00","close":"22:00"},"الجمعة":{"open":"14:00","close":"21:00"}}'::jsonb,
  (3.6 + (random() * 1.4))::numeric(3,2),
  (5 + (s.i % 120))::int,
  (s.i % 200)::int,
  'moderate',
  true,
  true,
  true,
  'imported'
FROM (SELECT generate_series(1, 3000)::int AS i) AS s
CROSS JOIN LATERAL (
  SELECT *
  FROM (
    VALUES
      (1, 'b4c8185e-557d-4a83-b9bd-3f210cb200a5'::uuid, 'الخبر', 26.3807::double precision, 50.0724::double precision),
      (2, 'bdddbe45-81c5-4674-91b9-f4b7541801a5'::uuid, 'الدمام', 26.4175, 50.0543),
      (3, '04c37aae-ea97-415d-9b44-e9481acbadba'::uuid, 'الأحساء', 26.3971, 50.1124),
      (4, 'a578c509-8bf1-41a7-8ce5-14fe75247158'::uuid, 'الجبيل', 26.4184, 50.1243),
      (5, '8e3458a4-ca9a-4384-8aaa-5c310c04ee3c'::uuid, 'القطيف', 26.3875, 50.0647),
      (
        6,
        COALESCE(
          (SELECT id FROM public.sa_cities WHERE region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c'::uuid AND name_ar = 'الظهران' LIMIT 1),
          'b4c8185e-557d-4a83-b9bd-3f210cb200a5'::uuid
        ),
        'الظهران',
        26.304::double precision,
        50.103::double precision
      )
  ) AS t(ord, city_id, city_name, clat, clng)
  WHERE t.ord = 1 + ((s.i - 1) % 6)
) c
CROSS JOIN LATERAL (
  SELECT category_label
  FROM (
    VALUES
      ('عيادة تجميل'),
      ('عيادة جلدية'),
      ('عيادة ليزر'),
      ('مركز تخسيس'),
      ('عيادة حقن وفيلر')
  ) AS x(category_label)
  OFFSET ((s.i - 1) % 5)
  LIMIT 1
) lbl;

-- 5) Assign diverse Unsplash cover URLs (80 base photos × unique query per business id)
UPDATE public.businesses AS b
SET
  cover_image = fmt.url,
  images = ARRAY[fmt.url]
FROM (
  SELECT
    o.id,
    format(
      'https://images.unsplash.com/photo-%s?w=800&auto=format&fit=crop&q=80&ix=%s',
      p.slug,
      replace(o.id::text, '-', '')
    ) AS url
  FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.businesses) o
  CROSS JOIN LATERAL (
    SELECT slug
    FROM (
      VALUES
        ('1544161515-4ab6ce6db874'::text),
        ('1522337360788-8b13dee7a37e'),
        ('1596462502278-27bfdc403543'),
        ('1487412947147-5cebf100ffc2'),
        ('1604654894610-df63bc536371'),
        ('1560066984-138dadb4c035'),
        ('1519741497674-611481863552'),
        ('1570172619644-dfd03ed5d881'),
        ('1629909613654-28e377c37b09'),
        ('1519415943484-9fa1873496d4'),
        ('1503951914875-452162b0f3f1'),
        ('1560750588-73207b1ef5b8'),
        ('1519699047748-de8e457a634e'),
        ('1596755389378-c31d21fd1273'),
        ('1605497788044-5a32c7078486'),
        ('1522338242992-e1a54906a8da'),
        ('1516975080664-ed2fc6a32937'),
        ('1560869713-da86aeead2a4'),
        ('1633681926022-84c23e8cb2d6'),
        ('1562322140-8ee00cf35a9a'),
        ('1519594422681-cbcefd984dbf'),
        ('1527799829374-d9a4941752ef'),
        ('1556228720-195a672e8a03'),
        ('1560493679578-2e9b8232a6e2'),
        ('1515377902966-c9a59d372d8d'),
        ('1507679799987-c73779587ccf'),
        ('1580618672591-eb180b1a973e'),
        ('1594736797933-d0801d621b30'),
        ('1512496015851-a90fb38ba796'),
        ('1522335780753-8ca8adad8cfd'),
        ('1535585206966-8931b087757c'),
        ('1516975080664-ed2fc6a32937'),
        ('1527799829374-d9a4941752ef'),
        ('1559599101-7d9c0a0d0586'),
        ('1515378791036-0648a3ef77b2'),
        ('1524504388940-b7c1679fc8c5'),
        ('1492106087820-71d1d7212be5'),
        ('1507003211169-0a1dd7228f2d'),
        ('1515378960530-7a88839ea254'),
        ('1522337094842-56a0e4f4e6b1'),
        ('1516975080664-ed2fc6a32937'),
        ('1522337360788-8b13dee7a37e'),
        ('1519415943484-9fa1873496d4'),
        ('1596462502278-27bfdc403543'),
        ('1487412947147-5cebf100ffc2'),
        ('1604654894610-df63bc536371'),
        ('1560066984-138dadb4c035'),
        ('1519741497674-611481863552'),
        ('1570172619644-dfd03ed5d881'),
        ('1629909613654-28e377c37b09'),
        ('1503951914875-452162b0f3f1'),
        ('1560750588-73207b1ef5b8'),
        ('1519699047748-de8e457a634e'),
        ('1596755389378-c31d21fd1273'),
        ('1605497788044-5a32c7078486'),
        ('1522338242992-e1a54906a8da'),
        ('1516975080664-ed2fc6a32937'),
        ('1560869713-da86aeead2a4'),
        ('1633681926022-84c23e8cb2d6'),
        ('1562322140-8ee00cf35a9a'),
        ('1519594422681-cbcefd984dbf'),
        ('1527799829374-d9a4941752ef'),
        ('1556228720-195a672e8a03'),
        ('1560493679578-2e9b8232a6e2'),
        ('1515377902966-c9a59d372d8d'),
        ('1507679799987-c73779587ccf'),
        ('1580618672591-eb180b1a973e'),
        ('1594736797933-d0801d621b30'),
        ('1512496015851-a90fb38ba796'),
        ('1522335780753-8ca8adad8cfd'),
        ('1535585206966-8931b087757c'),
        ('1559599101-7d9c0a0d0586'),
        ('1515378791036-0648a3ef77b2'),
        ('1524504388940-b7c1679fc8c5'),
        ('1492106087820-71d1d7212be5'),
        ('1507003211169-0a1dd7228f2d'),
        ('1515378960530-7a88839ea254'),
        ('1522337094842-56a0e4f4e6b1'),
        ('1516975080664-ed2fc6a32937'),
        ('1522337360788-8b13dee7a37e'),
        ('1519415943484-9fa1873496d4'),
        ('1596462502278-27bfdc403543'),
        ('1487412947147-5cebf100ffc2'),
        ('1604654894610-df63bc536371'),
        ('1560066984-138dadb4c035'),
        ('1519741497674-611481863552'),
        ('1570172619644-dfd03ed5d881')
    ) AS pool(slug)
    OFFSET ((o.rn - 1) % 80)
    LIMIT 1
  ) p
) fmt
WHERE b.id = fmt.id;

COMMIT;
