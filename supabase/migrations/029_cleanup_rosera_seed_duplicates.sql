-- Purge Rosera QA / batch seed duplicates (Eastern & nationwide) that clutter the map.
-- Safe to re-run: deletes only rows matching known seed markers or placeholder brand names.

BEGIN;

-- 1) Batch-21 low-coverage seed (tagged in description)
DELETE FROM public.businesses
WHERE description_ar IS NOT NULL
  AND description_ar LIKE '%[RoseraBatch21]%';

-- 2) Exact placeholder business names from test data (Arabic / English)
DELETE FROM public.businesses
WHERE (
    trim(COALESCE(name_ar, '')) = 'روزيرا'
    OR lower(trim(COALESCE(name_en, ''))) = 'rosera'
  )
  AND (
    COALESCE(is_demo, false) = true
    OR COALESCE(source_type, 'manual') IN ('verified', 'legacy_seed', 'imported')
    OR description_ar LIKE '%[Rosera%'
    OR cover_image LIKE '%placehold.co%'
  );

-- 3) Optional: master_seed QA rows in Eastern province only (same 3 placeholder images pattern).
--    Uncomment if you need to strip ALL [RoseraMaster:v1] listings in الشرقية (not only "روزيرا" name).
-- DELETE FROM public.businesses
-- WHERE region = 'المنطقة الشرقية'
--   AND description_ar IS NOT NULL
--   AND description_ar LIKE '%[RoseraMaster:v1]%';

-- 4) Prevent re-inserting the same Batch-21 row twice (same city + same Arabic name).
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_unique_city_name_batch21
ON public.businesses (city_id, lower(trim(name_ar)))
WHERE description_ar IS NOT NULL
  AND description_ar LIKE '%[RoseraBatch21]%';

COMMIT;
