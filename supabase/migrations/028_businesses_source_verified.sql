-- Allow curated QA / verified listing lineage on businesses (master_seed.sql)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'businesses'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.businesses DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_source_type_check
  CHECK (source_type IN ('manual', 'imported', 'provider_api', 'legacy_seed', 'verified'));
