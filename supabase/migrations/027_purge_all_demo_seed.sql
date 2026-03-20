-- Remove all Rosera demo / mass-import data (salons, clinics, store seeds flagged as demo or imported).
-- Does NOT remove sa_regions / sa_cities.
-- After apply: add real businesses via owner onboarding or INSERT (is_demo = false, source_type = 'manual').
-- See: rosera/docs/ADDING_REAL_BUSINESSES.md

BEGIN;

DELETE FROM public.products
WHERE COALESCE(is_demo, false) = true
   OR (source_type IS NOT NULL AND source_type IN ('imported', 'legacy_seed'));

DELETE FROM public.businesses
WHERE
  (description_ar IS NOT NULL AND (
    description_ar LIKE '%[RoseraSeed:v1]%'
    OR description_ar LIKE '%[RoseraClinic:v1]%'
  ))
  OR COALESCE(is_demo, false) = true
  OR (source_type IS NOT NULL AND source_type IN ('imported', 'legacy_seed'))
  OR (
    description_ar IS NOT NULL
    AND description_ar LIKE 'مركز تجميل وعناية في %'
    AND description_ar LIKE '%نقدم خدمات متكاملة بفريق متخصص وبيئة مريحة.%'
  );

COMMIT;
