-- Monetization: booking commission + paid boosts / sponsored ranking

-- Bookings: platform commission (default 10%)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1
    CHECK (commission_rate >= 0 AND commission_rate <= 1);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (commission_amount >= 0);

CREATE OR REPLACE FUNCTION public.apply_booking_commission ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.commission_rate IS NULL THEN
    NEW.commission_rate := 0.1;
  END IF;
  IF NEW.total_price IS NOT NULL THEN
    NEW.commission_amount := ROUND((NEW.total_price::NUMERIC * NEW.commission_rate::NUMERIC), 2);
  ELSE
    NEW.commission_amount := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_commission ON public.bookings;
CREATE TRIGGER trg_booking_commission
BEFORE INSERT OR UPDATE OF total_price, commission_rate
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.apply_booking_commission ();

COMMENT ON COLUMN public.bookings.commission_rate IS 'Platform take rate (0–1). Default 0.1 = 10%.';
COMMENT ON COLUMN public.bookings.commission_amount IS 'Set automatically: total_price * commission_rate.';

-- Boosts: salon-wide (business_id + product_id null) or single product (product_id set)
CREATE TABLE IF NOT EXISTS public.boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  business_id UUID REFERENCES public.businesses (id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products (id) ON DELETE CASCADE,
  boost_type TEXT NOT NULL CHECK (boost_type IN ('featured', 'priority')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  boost_score NUMERIC(5, 2) NOT NULL DEFAULT 12
    CHECK (boost_score >= 0 AND boost_score <= 25),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  CONSTRAINT boosts_date_range CHECK (end_date >= start_date),
  CONSTRAINT boosts_target CHECK (
    (product_id IS NULL AND business_id IS NOT NULL)
    OR (product_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_boosts_active_window ON public.boosts (is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_boosts_business ON public.boosts (business_id)
WHERE
  product_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_boosts_product ON public.boosts (product_id)
WHERE
  product_id IS NOT NULL;

COMMENT ON TABLE public.boosts IS 'Paid visibility: boost_score = percent uplift cap used by app ranking (e.g. 12 = up to ~12% of base score, hard-capped in client).';
COMMENT ON COLUMN public.boosts.boost_score IS 'Percent 0–25; client applies min(MAX_POINTS, baseScore * boost_score/100).';

ALTER TABLE public.boosts ENABLE ROW LEVEL SECURITY;

-- Marketplace: only currently valid boosts (for ranking / badges)
CREATE POLICY boosts_select_active_public ON public.boosts FOR SELECT
  USING (
    is_active = TRUE
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  );

-- Admins / supervisors: full access
CREATE POLICY boosts_admin_all ON public.boosts FOR ALL
  USING (public.is_supervisor_or_above ())
  WITH CHECK (public.is_supervisor_or_above ());

-- Expire past boosts (call from cron or Edge)
CREATE OR REPLACE FUNCTION public.deactivate_expired_boosts ()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.boosts
    SET is_active = FALSE
    WHERE
      is_active = TRUE
      AND end_date < CURRENT_DATE
    RETURNING
      id
  )
  SELECT
    count(*)::INTEGER
  FROM
    u;
$$;

REVOKE ALL ON FUNCTION public.deactivate_expired_boosts () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_boosts () TO service_role;

-- Backfill commission_amount on existing rows
UPDATE public.bookings
SET
  commission_amount = ROUND((COALESCE(total_price, 0)::NUMERIC * COALESCE(commission_rate, 0.1)::NUMERIC), 2)
WHERE
  total_price IS NOT NULL;
