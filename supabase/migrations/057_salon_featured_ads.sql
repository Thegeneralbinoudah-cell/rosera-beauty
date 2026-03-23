-- Paid featured ads: extra visibility + ranking (separate from subscription & boosts table)

CREATE TABLE IF NOT EXISTS public.salon_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  budget numeric(12, 2) NOT NULL CHECK (budget > 0),
  day_count integer NOT NULL CHECK (day_count >= 1 AND day_count <= 60),
  start_date date,
  end_date date,
  clicks integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pending_payment', 'active', 'expired', 'cancelled')),
  moyasar_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salon_ads_dates_when_active CHECK (
    (status = 'pending_payment' AND start_date IS NULL AND end_date IS NULL)
    OR (status <> 'pending_payment' AND start_date IS NOT NULL AND end_date IS NOT NULL)
  ),
  CONSTRAINT salon_ads_end_after_start CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_salon_ads_salon ON public.salon_ads (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_ads_active_window ON public.salon_ads (salon_id, status, start_date, end_date);

COMMENT ON TABLE public.salon_ads IS 'Salon-paid featured placement: budget = total SAR (day_count × daily rate); activate via verify-payment.';

ALTER TABLE public.salon_ads ENABLE ROW LEVEL SECURITY;

-- Anyone can see currently running ads (badges / ranking)
CREATE POLICY "salon_ads_select_active_public"
  ON public.salon_ads FOR SELECT
  USING (
    status = 'active'
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  );

-- Owners see all campaigns for their salon
CREATE POLICY "salon_ads_select_owner"
  ON public.salon_ads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.salon_owners so
      WHERE so.salon_id = salon_ads.salon_id AND so.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = salon_ads.salon_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "salon_ads_insert_owner"
  ON public.salon_ads FOR INSERT
  WITH CHECK (
    status = 'pending_payment'
    AND start_date IS NULL
    AND end_date IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_ads.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_ads.salon_id AND b.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "salon_ads_update_owner_cancel_pending"
  ON public.salon_ads FOR UPDATE
  USING (
    status = 'pending_payment'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_ads.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_ads.salon_id AND b.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_ads.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_ads.salon_id AND b.owner_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.expire_salon_ads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.salon_ads
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_salon_ads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_salon_ads() TO anon, authenticated;

-- Count a tap-through to the salon profile (best-effort; called from app)
CREATE OR REPLACE FUNCTION public.increment_salon_ad_click(p_salon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.salon_ads a
  SET clicks = clicks + 1
  WHERE a.id = (
    SELECT s.id
    FROM public.salon_ads s
    WHERE s.salon_id = p_salon_id
      AND s.status = 'active'
      AND s.start_date IS NOT NULL
      AND s.end_date IS NOT NULL
      AND s.start_date <= CURRENT_DATE
      AND s.end_date >= CURRENT_DATE
    ORDER BY s.created_at DESC
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.increment_salon_ad_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_salon_ad_click(uuid) TO anon, authenticated;
