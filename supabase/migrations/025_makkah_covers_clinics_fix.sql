-- Makkah hero image, clinic category fix, guaranteed Unsplash covers (20-photo cycle)

BEGIN;

-- Makkah region (Makkah / Haram aerial)
UPDATE public.sa_regions
SET image_url = 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&q=80'
WHERE id = '69f9b578-0a3b-4f08-b430-f2346a52686e';

-- Ensure RoseraClinic seed rows are category = clinic (fixes COUNT(*) WHERE category = 'clinic')
UPDATE public.businesses
SET category = 'clinic'
WHERE description_ar LIKE '%[RoseraClinic:v1]%'
  AND (category IS DISTINCT FROM 'clinic');

-- Every business: stable cover + images from 20 curated Unsplash IDs (w=400)
UPDATE public.businesses AS b
SET
  cover_image = u.url,
  images = ARRAY[u.url]
FROM (
  SELECT
    o.id,
    format(
      'https://images.unsplash.com/photo-%s?w=400&q=80',
      p.slug
    ) AS url
  FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.businesses) o
  CROSS JOIN LATERAL (
    SELECT slug
    FROM (
      VALUES
        ('1560066984-138dadb4c035'::text),
        ('1522337360826-43e8d2a67fd9'),
        ('1487412947147-5cebf100ffc2'),
        ('1519125323398-675f0ddb6308'),
        ('1516975080664-ed2fc6a32937'),
        ('1521590832167-7bcbfaa6381f'),
        ('1562322140-8baeababf751'),
        ('1595476108010-b4d1f102b1b1'),
        ('1487412720507-e7ab37603c6f'),
        ('1570172619644-dfd03ed5d881'),
        ('1611080626919-7cf5a9dbab12'),
        ('1583001308071-b248f5b3cb56'),
        ('1596755389378-c31d21fd1273'),
        ('1604654894610-df63bc536371'),
        ('1512207736890-6ffed8a84e8d'),
        ('1522335789203-aabd1fc54bc9'),
        ('1527799820374-dcf8d9d4a388'),
        ('1526045612212-70caf35c14df'),
        ('1515377905703-c4788e51af15'),
        ('1520338799039-eb02ff3dafbf')
    ) AS pool(slug)
    OFFSET (((o.rn - 1) % 20))
    LIMIT 1
  ) p
) u
WHERE b.id = u.id;

COMMIT;
