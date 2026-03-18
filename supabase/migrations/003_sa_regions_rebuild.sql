-- روزيرا: مناطق ومدن السعودية + إزالة بيانات العرض القديمة
-- نفّذي بعد 001 (أو من جديد). لا تمسّي profiles.

DELETE FROM public.reviews;
DELETE FROM public.bookings;
DELETE FROM public.favorites;
DELETE FROM public.offers;
DELETE FROM public.services;
DELETE FROM public.businesses;

DROP TABLE IF EXISTS public.sa_cities CASCADE;
DROP TABLE IF EXISTS public.sa_regions CASCADE;

CREATE TABLE public.sa_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  capital_ar TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.sa_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.sa_regions(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  UNIQUE(region_id, name_ar)
);

CREATE INDEX idx_sa_cities_region ON public.sa_cities(region_id);

ALTER TABLE public.businesses DROP COLUMN IF EXISTS city_id;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.sa_cities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_businesses_city_id ON public.businesses(city_id);

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category_label TEXT;

ALTER TABLE public.sa_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sa_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_regions_read" ON public.sa_regions FOR SELECT USING (true);
CREATE POLICY "sa_cities_read" ON public.sa_cities FOR SELECT USING (true);
