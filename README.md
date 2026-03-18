# روزيرا ROSERA

تطبيق حجز صالونات ومراكز التجميل (React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase + PWA).

## الحزم (مطابقة للمواصفات)

`@supabase/supabase-js`، `react-router-dom`، `leaflet` / `react-leaflet`، `framer-motion`، `lucide-react`، Radix (dialog, tabs, dropdown, …)، `date-fns`، `react-day-picker` (تقويم shadcn)، Tailwind + RTL، مكوّنات UI: button, input, card, dialog, tabs, **toast (Sonner)**, avatar, badge, **calendar**, dropdown-menu, **sheet**, skeleton, separator.

## التشغيل

```bash
cd rosera
cp .env.example .env
npm install
npm run dev
```

إذا فشل البناء بسبب `baseline-browser-mapping`، هي مضافة في `devDependencies`.

## قاعدة البيانات (Supabase)

1. في **SQL Editor** نفّذي بالترتيب:
   - `supabase/migrations/001_schema.sql`
   - إن وُجد خطأ في الـ trigger، استبدلي السطر الأخير بـ:  
     `FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`  
     (حسب إصدار PostgreSQL).
2. ولإعادة توليد بيانات العينة ثم تنفيذها:
   ```bash
   npm run seed:sql
   ```
   ثم نفّذي الملف الناتج `supabase/migrations/002_seed.sql` في SQL Editor.

3. **مدير النظام:** بعد تسجيل مستخدم `admin@rosera.com`:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@rosera.com';
   ```
4. **صاحبة منشأة:** عيّني `role = 'business_owner'` واربطي `businesses.owner_id` بـ `profiles.id`.

## المسارات

- عميل: `/`، `/search`، `/map`، `/salon/:id`، `/booking/:id`، `/bookings`، `/favorites`، `/profile`، العروض، الإشعارات، روز AI، كشف البشرة، الدعوة، الإعدادات.
- أدمن: `/admin` (محمي).
- لوحة المنشأة: `/dashboard` (محمي).

## PWA

البناء ينتج Service Worker تلقائياً. استبدلي `public/pwa-192.png` و `pwa-512.png` بأيقونات حقيقية للنشر.
