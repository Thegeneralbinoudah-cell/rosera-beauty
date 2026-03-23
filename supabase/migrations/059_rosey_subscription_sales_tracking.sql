-- Rosy subscription upsell: throttle + 2-day follow-up (client chat only; no service role in rozi-chat)

CREATE TABLE IF NOT EXISTS public.rosey_subscription_upsell_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  last_cta_at timestamptz NOT NULL DEFAULT now(),
  follow_up_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rosey_upsell_salon ON public.rosey_subscription_upsell_state (salon_id);

COMMENT ON TABLE public.rosey_subscription_upsell_state IS 'Throttles Rosy «ترقية الآن» CTA; follow_up_at set after 2d reminder.';

ALTER TABLE public.rosey_subscription_upsell_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rosey_upsell_state_select_own"
  ON public.rosey_subscription_upsell_state FOR SELECT
  USING (auth.uid() = user_id);

-- Salon owners: log subscription upsell CTA clicks for Rosy follow-up logic
ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_event_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_event_type_check
  CHECK (
    event_type IN (
      'view',
      'click',
      'book',
      'view_salon',
      'booking_click',
      'ai_recommended_view',
      'payment_success',
      'offer_applied',
      'user_preference',
      'subscription_started',
      'subscription_upgraded',
      'salon_clicks',
      'rosy_salon_subscription_upsell_click'
    )
  );

CREATE OR REPLACE FUNCTION public.mark_rosey_subscription_upsell_shown(p_mode text)
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
    RETURN;
  END IF;
  IF p_mode IS NULL OR (p_mode <> 'primary' AND p_mode <> 'follow_up') THEN
    RETURN;
  END IF;

  SELECT so.salon_id INTO sid FROM public.salon_owners so WHERE so.user_id = uid LIMIT 1;
  IF sid IS NULL THEN
    SELECT b.id INTO sid FROM public.businesses b WHERE b.owner_id = uid LIMIT 1;
  END IF;
  IF sid IS NULL THEN
    RETURN;
  END IF;

  IF p_mode = 'primary' THEN
    INSERT INTO public.rosey_subscription_upsell_state (user_id, salon_id, last_cta_at, follow_up_at, updated_at)
    VALUES (uid, sid, now(), NULL, now())
    ON CONFLICT (user_id) DO UPDATE SET
      salon_id = EXCLUDED.salon_id,
      last_cta_at = now(),
      follow_up_at = NULL,
      updated_at = now();
  ELSE
    INSERT INTO public.rosey_subscription_upsell_state (user_id, salon_id, last_cta_at, follow_up_at, updated_at)
    VALUES (uid, sid, now(), now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      salon_id = EXCLUDED.salon_id,
      last_cta_at = now(),
      follow_up_at = now(),
      updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_rosey_subscription_upsell_shown(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_rosey_subscription_upsell_shown(text) TO authenticated;
