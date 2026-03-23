-- Booking commission: explicit platform fee % (default 10) + synced commission_amount
-- Revenue recognition: report SUM(commission_amount) only for status = 'completed' (app layer).
-- Moyasar: full amount to merchant account; commission_amount is for reconciliation / future payouts.
-- Stripe Connect: use application_fee_amount = commission in halalas at checkout (when implemented).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS platform_fee_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10
  CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100);

COMMENT ON COLUMN public.bookings.platform_fee_percentage IS 'Platform fee percent of total_price (e.g. 10 = 10%). Drives commission_amount via trigger.';
COMMENT ON COLUMN public.bookings.commission_amount IS 'total_price * platform_fee_percentage / 100. Count as platform revenue when status = completed.';

UPDATE public.bookings
SET
  platform_fee_percentage = LEAST(
    100,
    GREATEST(0, ROUND((COALESCE(commission_rate, 0.1)::NUMERIC * 100), 2))
  );

CREATE OR REPLACE FUNCTION public.apply_booking_commission ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.commission_rate IS DISTINCT FROM OLD.commission_rate AND NEW.platform_fee_percentage IS NOT DISTINCT FROM OLD.platform_fee_percentage THEN
    NEW.platform_fee_percentage := LEAST(
      100,
      GREATEST(0, ROUND((COALESCE(NEW.commission_rate, 0.1)::NUMERIC * 100), 2))
    );
  END IF;

  IF NEW.platform_fee_percentage IS NULL THEN
    NEW.platform_fee_percentage := 10;
  END IF;
  IF NEW.platform_fee_percentage < 0 THEN
    NEW.platform_fee_percentage := 0;
  END IF;
  IF NEW.platform_fee_percentage > 100 THEN
    NEW.platform_fee_percentage := 100;
  END IF;

  NEW.commission_rate := (NEW.platform_fee_percentage / 100.0)::NUMERIC(5, 4);

  IF NEW.total_price IS NOT NULL THEN
    NEW.commission_amount := ROUND((NEW.total_price::NUMERIC * NEW.platform_fee_percentage / 100.0), 2);
  ELSE
    NEW.commission_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_commission ON public.bookings;
CREATE TRIGGER trg_booking_commission
BEFORE INSERT OR UPDATE OF total_price, platform_fee_percentage, commission_rate
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.apply_booking_commission ();

-- Recalculate all rows from new rules
UPDATE public.bookings
SET
  total_price = total_price
WHERE
  total_price IS NOT NULL;
