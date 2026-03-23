-- Full vision JSON from Edge skin-analysis
ALTER TABLE public.skin_analysis
  ADD COLUMN IF NOT EXISTS analysis_result jsonb;

COMMENT ON COLUMN public.skin_analysis.analysis_result IS 'Structured output from OpenAI vision (skin-analysis Edge)';

-- Bucket: public read so OpenAI can fetch URL; uploads restricted to own folder {user_id}/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'skin-analysis',
  'skin-analysis',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "skin_analysis_insert_own" ON storage.objects;
CREATE POLICY "skin_analysis_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'skin-analysis'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "skin_analysis_update_own" ON storage.objects;
CREATE POLICY "skin_analysis_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'skin-analysis'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'skin-analysis'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "skin_analysis_delete_own" ON storage.objects;
CREATE POLICY "skin_analysis_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'skin-analysis'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "skin_analysis_select" ON storage.objects;
CREATE POLICY "skin_analysis_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'skin-analysis');
