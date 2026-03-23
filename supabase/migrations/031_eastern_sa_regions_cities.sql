-- Idempotent: يضمن وجود «المنطقة الشرقية» ومدنها الرئيسية (الدمام، الخبر، الظهران، الأحساء، …)
-- آمن لإعادة التشغيل — لا يحذف بيانات موجودة.
-- بعد التطبيق: supabase db push أو لصق الملف في SQL Editor.

BEGIN;

INSERT INTO public.sa_regions (id, name_ar, capital_ar, image_url, sort_order)
VALUES (
  'ea1d1ff8-dd96-497b-949e-02d51a55e97c',
  'المنطقة الشرقية',
  'الدمام',
  'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80',
  5
)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  capital_ar = EXCLUDED.capital_ar,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

-- مدن المنطقة الشرقية (معرّفات ثابتة من بذرة 004 / 014 حيث وُجدت)
INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'bdddbe45-81c5-4674-91b9-f4b7541801a5', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الدمام', 26.41751818181818, 50.05425454545455
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الدمام');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '04c37aae-ea97-415d-9b44-e9481acbadba', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الأحساء', 26.397063636363637, 50.11243636363636
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الأحساء');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'ef16a3ff-093d-475c-a543-00dfeb709b89', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'حفر الباطن', 26.38797272727273, 50.0638
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'حفر الباطن');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'a578c509-8bf1-41a7-8ce5-14fe75247158', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الجبيل', 26.41842727272727, 50.12425454545455
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الجبيل');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '8e3458a4-ca9a-4384-8aaa-5c310c04ee3c', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'القطيف', 26.387518181818184, 50.06470909090909
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'القطيف');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'b4c8185e-557d-4a83-b9bd-3f210cb200a5', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الخبر', 26.3807, 50.07243636363636
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الخبر');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'fac0f1a6-aaa8-4360-af7d-a59b1452e208', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الخفجي', 26.406154545454545, 50.09334545454546
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الخفجي');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '2a67365d-dc6a-425e-a308-cabb82be7ca9', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'رأس تنورة', 26.412972727272727, 50.0588
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'رأس تنورة');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '79e36e91-3ebb-4384-ac9a-d8f5a8f70973', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'بقيق', 26.38979090909091, 50.05243636363636
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'بقيق');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'd9cf27ae-28af-470f-b81a-fce88bac0b6f', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'النعيرية', 26.45160909090909, 50.1188
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'النعيرية');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '1864a039-7287-42a6-bd34-d4c5dca13e89', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'قرية العليا', 26.40388181818182, 50.07152727272727
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'قرية العليا');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT '351a0105-ad6d-450d-aaa9-98699b3f303a', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'العديد', 26.403427272727274, 50.11061818181818
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'العديد');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'd2000001-0001-4000-8000-000000000001', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'الظهران', 26.2880, 50.1140
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'الظهران');

INSERT INTO public.sa_cities (id, region_id, name_ar, latitude, longitude)
SELECT 'd2000002-0002-4000-8000-000000000002', 'ea1d1ff8-dd96-497b-949e-02d51a55e97c', 'العيون', 25.6167, 49.6167
WHERE NOT EXISTS (SELECT 1 FROM public.sa_cities c WHERE c.region_id = 'ea1d1ff8-dd96-497b-949e-02d51a55e97c' AND c.name_ar = 'العيون');

COMMIT;
