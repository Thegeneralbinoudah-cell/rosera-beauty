-- Canonical category for Home / Search chips (salon | clinic | spa | makeup | skincare)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS category_value TEXT;

COMMENT ON COLUMN public.businesses.category_value IS 'App category chip: salon, clinic, spa, makeup, skincare';

UPDATE public.businesses
SET category_value = lower(trim(category))
WHERE category_value IS NULL
  AND lower(trim(category)) IN ('salon', 'clinic', 'spa', 'makeup', 'skincare');

UPDATE public.businesses
SET category_value = 'salon'
WHERE category_value IS NULL
  AND trim(category_label) = 'صالون نسائي';

UPDATE public.businesses
SET category_value = 'clinic'
WHERE category_value IS NULL
  AND trim(category_label) IN ('عيادات تجميل', 'عيادة تجميل', 'عيادة جلدية', 'عيادة ليزر', 'عيادة حقن وفيلر');

UPDATE public.businesses
SET category_value = 'spa'
WHERE category_value IS NULL
  AND trim(category_label) = 'سبا ومساج';

UPDATE public.businesses
SET category_value = 'makeup'
WHERE category_value IS NULL
  AND trim(category_label) = 'مكياج';

UPDATE public.businesses
SET category_value = 'skincare'
WHERE category_value IS NULL
  AND trim(category_label) = 'عناية بالبشرة';

UPDATE public.businesses
SET category_value = 'clinic'
WHERE category_value IS NULL
  AND lower(trim(category)) = 'clinic';

UPDATE public.businesses
SET category_value = 'spa'
WHERE category_value IS NULL
  AND lower(trim(category)) = 'spa';

UPDATE public.businesses
SET category_value = 'salon'
WHERE category_value IS NULL
  AND lower(trim(category)) IN ('salon', 'beauty_salon');
