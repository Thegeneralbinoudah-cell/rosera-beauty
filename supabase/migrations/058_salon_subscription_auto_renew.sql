-- Auto-renew salon subscriptions: saved Moyasar token, renewal logs, grace before expiry

ALTER TABLE public.salon_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_failed_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.salon_subscriptions.auto_renew IS 'When true, daily job attempts Moyasar charge before/at expiry using payment_method_id.';
COMMENT ON COLUMN public.salon_subscriptions.payment_method_id IS 'Moyasar source.token from card tokenization (save_card).';
COMMENT ON COLUMN public.salon_subscriptions.last_payment_at IS 'Last successful subscription charge (initial or renewal).';
COMMENT ON COLUMN public.salon_subscriptions.renewal_failed_count IS 'Consecutive failed renewal charges; at 3 subscription is expired.';

CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_auto_renew_due
  ON public.salon_subscriptions (expires_at)
  WHERE status = 'active' AND auto_renew = true AND payment_method_id IS NOT NULL AND renewal_failed_count < 3;

CREATE TABLE IF NOT EXISTS public.salon_subscription_renewal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.salon_subscriptions (id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 3),
  moyasar_payment_id text,
  error_message text,
  amount_halalas integer
);

CREATE INDEX IF NOT EXISTS idx_renewal_logs_sub ON public.salon_subscription_renewal_logs (subscription_id);
CREATE INDEX IF NOT EXISTS idx_renewal_logs_salon ON public.salon_subscription_renewal_logs (salon_id);

ALTER TABLE public.salon_subscription_renewal_logs ENABLE ROW LEVEL SECURITY;

-- Owners read their salon logs
CREATE POLICY "salon_renewal_logs_select_owner"
  ON public.salon_subscription_renewal_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.salon_owners so
      WHERE so.salon_id = salon_subscription_renewal_logs.salon_id AND so.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = salon_subscription_renewal_logs.salon_id AND b.owner_id = auth.uid()
    )
  );

-- Inserts only from service role / edge (no client insert policy)

-- Expire: keep "active" past expires_at only while auto-renew may still succeed (< 3 failures + token)
CREATE OR REPLACE FUNCTION public.expire_salon_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.salon_subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now()
    AND NOT (
      auto_renew = true
      AND payment_method_id IS NOT NULL
      AND renewal_failed_count < 3
    );

  UPDATE public.businesses b
  SET is_featured = false
  WHERE b.is_featured = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.salon_subscriptions s
      WHERE s.salon_id = b.id
        AND s.status = 'active'
        AND s.plan = 'premium'
        AND s.expires_at IS NOT NULL
        AND s.expires_at > now()
    );
END;
$$;

-- Toggle auto_renew for current owner's active subscription
CREATE OR REPLACE FUNCTION public.set_salon_subscription_auto_renew(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'غير مصرّح';
  END IF;

  SELECT so.salon_id INTO sid
  FROM public.salon_owners so
  WHERE so.user_id = uid
  LIMIT 1;

  IF sid IS NULL THEN
    SELECT b.id INTO sid FROM public.businesses b WHERE b.owner_id = uid LIMIT 1;
  END IF;

  IF sid IS NULL THEN
    RAISE EXCEPTION 'لا يوجد صالون مرتبط';
  END IF;

  UPDATE public.salon_subscriptions
  SET auto_renew = p_enabled
  WHERE salon_id = sid
    AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.set_salon_subscription_auto_renew(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_salon_subscription_auto_renew(boolean) TO authenticated;
