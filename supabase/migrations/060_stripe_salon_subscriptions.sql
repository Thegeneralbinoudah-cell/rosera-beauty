-- Stripe Billing for salon subscriptions (card + Apple Pay via Stripe.js; renewals via webhooks)

ALTER TABLE public.salon_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'moyasar'
    CHECK (billing_provider IN ('moyasar', 'stripe')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_salon_subscriptions_stripe_subscription
  ON public.salon_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.salon_subscriptions.billing_provider IS 'moyasar: Moyasar + renew-salon-subscriptions cron; stripe: Stripe Billing + webhooks.';
COMMENT ON COLUMN public.salon_subscriptions.stripe_customer_id IS 'Stripe Customer id (cus_…).';
COMMENT ON COLUMN public.salon_subscriptions.stripe_subscription_id IS 'Stripe Subscription id (sub_…); renewals update expires_at from invoice.paid.';

-- Stripe rows may have NULL payment_method_id; still auto-renew via Stripe (avoid premature expire)
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
        AND renewal_failed_count < 3
        AND (
          (payment_method_id IS NOT NULL AND billing_provider = 'moyasar')
          OR (billing_provider = 'stripe' AND stripe_subscription_id IS NOT NULL)
        )
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
