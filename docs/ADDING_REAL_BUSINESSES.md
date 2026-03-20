# Adding real salons, spas & clinics (no demo data)

After migration **`027_purge_all_demo_seed.sql`**, the `businesses` table should only contain rows you add intentionally.

## 1. Owner self-service (recommended)

Have each provider sign up as **owner**, create their business in the owner dashboard, and upload real photos, phone, and location. Those rows should stay with:

- `is_demo = false`
- `source_type = 'manual'`

## 2. SQL template (admin)

Replace placeholders and run in Supabase SQL Editor (match `city_id` to `public.sa_cities`):

```sql
INSERT INTO public.businesses (
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
  is_active,
  is_verified,
  is_demo,
  source_type
) VALUES (
  (SELECT id FROM public.sa_cities WHERE name_ar = 'النعيرية' LIMIT 1),
  'اسم المحل الحقيقي',
  'وصف قصير حقيقي من صاحبة المحل — بدون وسوم تجريبية.',
  'salon',  -- or 'spa' | 'clinic'
  'صالون نسائي',  -- label shown in app
  'النعيرية',
  'المنطقة الشرقية',
  'العنوان الكامل',
  27.4167,
  49.4167,
  '+9665xxxxxxxx',
  '+9665xxxxxxxx',
  'https://your-cdn.example.com/cover.jpg',
  ARRAY['https://your-cdn.example.com/photo1.jpg'],
  '{"السبت":{"open":"10:00","close":"22:00"}}'::jsonb,
  true,
  false,
  false,
  'manual'
);
```

Do **not** put `[RoseraSeed:v1]` or `[RoseraClinic:v1]` in `description_ar` (those mark automated seed rows for deletion).

## 3. Re-running migrations locally

`supabase db reset` will replay older migrations that **insert** mass seed (023/024), then **027** removes it again. End state: **no demo businesses**.

## 4. Products (beauty store)

Demo products are removed when flagged `is_demo` or `source_type` in (`imported`, `legacy_seed`). Add real SKUs from **Admin → Products** with `is_demo = false`.
