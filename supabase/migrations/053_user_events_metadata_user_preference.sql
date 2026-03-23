-- Rich preference signals for Rosy / ranking (service, price band, city)
ALTER TABLE public.user_events
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

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
      'user_preference'
    )
  );

ALTER TABLE public.user_events DROP CONSTRAINT IF EXISTS user_events_entity_type_check;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_entity_type_check
  CHECK (entity_type IN ('service', 'product', 'business', 'booking', 'preference'));

COMMENT ON COLUMN public.user_events.metadata IS 'JSON payload for analytics (e.g. user_preference: service, location, price_range)';
