-- Marketplace offer fields + admin policies (table exists in 001_schema)
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE public.offers
SET title = COALESCE(NULLIF(trim(title), ''), title_ar)
WHERE title IS NULL AND title_ar IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offers_business_active ON public.offers (business_id)
  WHERE is_active = true;

CREATE POLICY "p_offers_select_team" ON public.offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_offers_insert_admin" ON public.offers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "p_offers_update_admin" ON public.offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "p_offers_delete_admin" ON public.offers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner')
    )
  );
