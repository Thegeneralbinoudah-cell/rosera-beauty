-- Seed / Google Places: quality tier for listings (strict vs fallback pipeline)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS data_quality TEXT;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_data_quality_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_data_quality_check
  CHECK (data_quality IS NULL OR data_quality IN ('high', 'medium'));

COMMENT ON COLUMN public.businesses.data_quality IS 'Listing quality: high (photo + rating > 4), medium (fallback or lower bar).';
