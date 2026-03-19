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
4. **صاحبة منشأة:** عيّني `role = 'business_owner'` **أو** أضيفي صفاً في `salon_owners` (`user_id` + `salon_id` = `businesses.id`).
5. **ترحيلات إضافية (بالترتيب):** `006_otp_owner_admin_push.sql`، `007_salon_owner_rls.sql`، `008_profiles_suspended_admin_policies.sql`، `009_salon_blocked_slots.sql`.
6. **Edge Functions:** انشري `send-otp`، `verify-otp`، `send-notification` واضبطي الأسرار:
   - Twilio: `TWILIO_ACCOUNT_SID`، `TWILIO_AUTH_TOKEN`، `TWILIO_FROM`
   - اختياري للدفع: `FCM_SERVER_KEY`
7. **تخزين الصور:** أنشئي دلو `avatars` (عام القراءة) إن لم يكن موجوداً — رفع الصورة من التطبيق يستخدم `supabase.storage.from('avatars')`.
8. **مسؤول عبر الجدول:** أضيفي صفاً في `admins` لـ `user_id` المطلوب.

## المسارات

- عميل: `/`، `/home`، `/auth`، `/verify-otp`، البحث، الخريطة، الصالون، الحجز، الحساب، …
- أدمن: `/admin/login` ثم `/admin`، `/admin/salons`، `/admin/users`، `/admin/bookings`، `/admin/revenue`، …
- لوحة الصالون: `/owner/login` ثم `/owner`، `/owner/bookings`، … — المسار القديم `/dashboard` يُحوَّل تلقائياً إلى `/owner`.

## Capacitor (iOS / Android)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard @capacitor/geolocation @capacitor/push-notifications
npx cap add ios
npx cap add android
```

الإعداد في `capacitor.config.ts`. للبناء: `npm run cap:build`، `npm run cap:ios`، `npm run cap:android`.

## PWA

- `public/manifest.json` + أيقونات `public/icons/icon-192.png` و `icon-512.png` (أضيفيهما يدوياً إن لزم).
- تُسجَّل في الإنتاج خدمة العامل `public/rosera-sw.js` (اسم مميز لأن `vite-plugin-pwa` يولّد `sw.js` منفصل).

## النشر (Vercel)

ملف `vercel.json` جاهز لإعادة توجيه SPA والرؤوس الأمنية.
