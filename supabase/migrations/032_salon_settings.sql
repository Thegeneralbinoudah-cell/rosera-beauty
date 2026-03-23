-- Per-salon payment behavior: drives whether Moyasar checkout is shown (booking flow).
-- payment_method: moyasar = Moyasar widget; cash = pay at salon only; disabled = block online payment

CREATE TABLE IF NOT EXISTS public.salon_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'moyasar',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT salon_settings_payment_method_check CHECK (payment_method IN ('moyasar', 'cash', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_salon_settings_business ON public.salon_settings (business_id);

ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;

-- Idempotent: remote may already have policies if table was created outside migration history.
DROP POLICY IF EXISTS "salon_settings_select_public" ON public.salon_settings;
DROP POLICY IF EXISTS "salon_settings_mutate_by_salon_owner" ON public.salon_settings;

CREATE POLICY "salon_settings_select_public" ON public.salon_settings FOR SELECT USING (true);

CREATE POLICY "salon_settings_mutate_by_salon_owner" ON public.salon_settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    WHERE so.user_id = auth.uid() AND so.salon_id = salon_settings.business_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    WHERE so.user_id = auth.uid() AND so.salon_id = salon_settings.business_id
  )
);
