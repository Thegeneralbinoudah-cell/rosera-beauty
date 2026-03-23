-- B2B salon monthly subscriptions (Moyasar + ranking + featured badge)
CREATE TABLE IF NOT EXISTS public.salon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'premium')),
  status text NOT NULL CHECK (status IN ('pending_payment', 'active', 'expired', 'cancelled')),
  price numeric(12, 2) NOT NULL CHECK (price > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  moyasar_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_salon ON public.salon_subscriptions (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_salon_status ON public.salon_subscriptions (salon_id, status);
CREATE INDEX IF NOT EXISTS idx_salon_subscriptions_expires ON public.salon_subscriptions (expires_at)
  WHERE status = 'active';

COMMENT ON TABLE public.salon_subscriptions IS 'Salon B2B plans: basic/pro/premium; activate via verify-payment Edge after Moyasar.';

-- businesses.is_featured exists in 001_schema; ensure default (idempotent)
ALTER TABLE public.businesses
  ALTER COLUMN is_featured SET DEFAULT false;

ALTER TABLE public.salon_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_subscriptions_select_owner"
  ON public.salon_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.salon_owners so
      WHERE so.salon_id = salon_subscriptions.salon_id AND so.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = salon_subscriptions.salon_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "salon_subscriptions_insert_owner"
  ON public.salon_subscriptions FOR INSERT
  WITH CHECK (
    status = 'pending_payment'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_subscriptions.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_subscriptions.salon_id AND b.owner_id = auth.uid()
      )
    )
  );

-- Owner may cancel stale pending rows before starting a new checkout (no direct activation from client)
CREATE POLICY "salon_subscriptions_update_owner_cancel_pending"
  ON public.salon_subscriptions FOR UPDATE
  USING (
    status = 'pending_payment'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_subscriptions.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_subscriptions.salon_id AND b.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = salon_subscriptions.salon_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = salon_subscriptions.salon_id AND b.owner_id = auth.uid()
      )
    )
  );

-- Activation / expiry only via service role (verify-payment) or SECURITY DEFINER below

CREATE OR REPLACE FUNCTION public.expire_salon_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.salon_subscriptions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now();

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

REVOKE ALL ON FUNCTION public.expire_salon_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_salon_subscriptions() TO anon, authenticated;
