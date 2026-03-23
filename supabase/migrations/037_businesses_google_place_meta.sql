-- بيانات وصفية من Google Places (بدون تخزين مفتاح API في روابط الصور)
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_photo_resource TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_google_place_id_unique
  ON public.businesses (google_place_id)
  WHERE google_place_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.google_place_id IS 'Places API (New) resource name, e.g. places/ChIJ...';
COMMENT ON COLUMN public.businesses.google_photo_resource IS 'First photo resource name for places.googleapis.com/v1/NAME/media';
