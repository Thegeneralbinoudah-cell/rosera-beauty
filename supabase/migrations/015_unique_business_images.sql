-- Ensure each business has unique Unsplash image URLs
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM public.businesses
)
UPDATE public.businesses b
SET
  cover_image = format('https://source.unsplash.com/1200x900/?beauty,salon,spa,clinic&sig=%s', ranked.rn),
  images = ARRAY[
    format('https://source.unsplash.com/1200x900/?beauty,salon,spa,clinic&sig=%s', ranked.rn),
    format('https://source.unsplash.com/1200x900/?beauty,salon,spa,clinic&sig=%s', ranked.rn + 10000)
  ]
FROM ranked
WHERE b.id = ranked.id;
