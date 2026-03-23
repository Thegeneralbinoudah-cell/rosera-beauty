-- حذف منشآت وهمية / بذور / دفعات أدمن — لا تمسّ sa_regions / sa_cities.
-- يُبقى: owner onboarding (manual)، واستيراد Google (provider_api) بلا علامات بذرة.
-- تحذير: يحذف صفوف مرتبطة (حجوزات، خدمات، …) CASCADE من public.businesses.

BEGIN;

DELETE FROM public.businesses
WHERE COALESCE(is_demo, false) = true
   OR (source_type IS NOT NULL AND source_type IN ('imported', 'legacy_seed'))
   OR (description_ar IS NOT NULL AND (
        description_ar LIKE '%[RoseraSeed:v1]%'
     OR description_ar LIKE '%[RoseraClinic:v1]%'
     OR description_ar LIKE '%[RoseraExclusive:v1]%'
     OR description_ar LIKE '%[RoseraExclusive:v2]%'
     OR description_ar LIKE '%[RoseraVerified:v1]%'
     OR description_ar LIKE '%[RoseraBatch21]%'
     OR description_ar LIKE '%[RoseraMaster:v1]%'
   ))
   OR (cover_image IS NOT NULL AND cover_image ILIKE '%placehold.co%')
   OR (
        description_ar IS NOT NULL
    AND description_ar LIKE 'مركز تجميل وعناية في %'
    AND description_ar LIKE '%نقدم خدمات متكاملة بفريق متخصص وبيئة مريحة.%'
   );

COMMIT;
