-- إزالة منشآت RoseraExclusive:v2 (دفعة 035 الافتراضية — 66 صفاً).
-- بعد التطبيق: شغّلي مزامنة Google Places محلياً:
--   cd rosera && npm run seed:eastern-places
-- (تحتاج VITE_GOOGLE_MAPS_API_KEY + SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL)

DELETE FROM public.businesses
WHERE description_ar LIKE '%[RoseraExclusive:v2]%';
