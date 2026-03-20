-- One-time cleanup: remove male barber shops for ROSERA (women-only product).
-- Manual seeds are `manual_batch_02` … `manual_batch_05` (there is no `manual_batch_01` in this repo).
-- Run in Supabase SQL Editor after those batches were applied, before or after `manual_batch_06_women_only.sql`.

BEGIN;

DELETE FROM public.businesses
WHERE source_type = 'manual'
  AND (
    category_label = 'صالونات حلاقة رجالية'
    OR description_ar ILIKE '%حلاقة رجالية%'
    OR name_ar ILIKE '%للرجال%'
    OR name_ar IN (
      'حلاق ركن الأناقة',
      'حلاق أنقرة',
      'حلاق اسطنبول',
      'حلاق ركن الشباب',
      'حلاق الأناقة الحديثة',
      'حلاق الركن الهادئ',
      'صالون الفخامة الرجالي',
      'صالون العناية بالشعر (للرجال)'
    )
  );

COMMIT;

-- Optional — only if you also have `صالونات حلاقة رجالية` from imports/other source_type.
-- Review bookings/FK impact first.
-- DELETE FROM public.businesses WHERE category_label = 'صالونات حلاقة رجالية';
