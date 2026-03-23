-- Replace placeholder (placehold.co) and deprecated source.unsplash.com covers with stable images.unsplash.com URLs.
-- Pool matches manual_batch_21 / DEFAULT_BUSINESS_COVER_IMAGE — varied by business id.

BEGIN;

UPDATE public.businesses AS b
SET
  cover_image = p.u[(abs(hashtext(b.id::text)) % 12) + 1],
  images = ARRAY[
    p.u[(abs(hashtext(b.id::text)) % 12) + 1],
    p.u[(abs(hashtext(b.id::text || ':2')) % 12) + 1]
  ]
FROM (
  SELECT ARRAY[
    'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1503951914875-452162ca0d25?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?w=1200&q=80&auto=format&fit=crop'
  ]::text[] AS u
) AS p
WHERE
  b.cover_image IS NOT NULL
  AND (
    b.cover_image ILIKE '%placehold.co%'
    OR b.cover_image ILIKE '%source.unsplash.com%'
    OR (b.images IS NOT NULL AND b.images::text ILIKE '%placehold.co%')
  );

COMMIT;
