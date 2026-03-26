-- Rosy: hesitation tone exposure/conversion analytics + adaptive weighting (rozi-chat RPC)

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
      'rosy_salon_subscription_upsell_click',
      'rosy_hesitation_tone_shown',
      'rosy_hesitation_checkout'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_events_rosey_hesitation_created
  ON public.user_events (event_type, created_at DESC);

COMMENT ON INDEX idx_user_events_rosey_hesitation_created IS 'Analytics for rosey_hesitation_tone_* events (90d aggregates in RPC).';

-- Aggregated stats for Edge rozi-chat (Laplace-smoothed rates computed in app; raw counts here)
CREATE OR REPLACE FUNCTION public.rosey_hesitation_tone_stats(p_days integer DEFAULT 90)
RETURNS TABLE (
  tone text,
  exposures bigint,
  conversions bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH bounds AS (
    SELECT GREATEST(7, LEAST(COALESCE(p_days, 90), 365))::int AS days
  ),
  shown AS (
    SELECT
      COALESCE(metadata->>'tone', metadata->>'checkout_hesitation_tone') AS tone_key,
      COUNT(*)::bigint AS cnt
    FROM public.user_events, bounds b
    WHERE event_type = 'rosy_hesitation_tone_shown'
      AND created_at >= now() - (b.days || ' days')::interval
    GROUP BY 1
  ),
  conv AS (
    SELECT
      COALESCE(metadata->>'tone', metadata->>'checkout_hesitation_tone') AS tone_key,
      COUNT(*)::bigint AS cnt
    FROM public.user_events, bounds b
    WHERE event_type = 'rosy_hesitation_checkout'
      AND created_at >= now() - (b.days || ' days')::interval
    GROUP BY 1
  )
  SELECT
    t.tone,
    COALESCE(s.cnt, 0)::bigint AS exposures,
    COALESCE(c.cnt, 0)::bigint AS conversions
  FROM (SELECT unnest(ARRAY['direct', 'soft', 'choice']) AS tone) t
  LEFT JOIN shown s ON s.tone_key = t.tone
  LEFT JOIN conv c ON c.tone_key = t.tone;
$$;

REVOKE ALL ON FUNCTION public.rosey_hesitation_tone_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rosey_hesitation_tone_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rosey_hesitation_tone_stats(integer) TO service_role;

COMMENT ON FUNCTION public.rosey_hesitation_tone_stats(integer) IS 'Per-tone exposure/conversion counts for Rosy checkout hesitation A/B (rolling window).';
