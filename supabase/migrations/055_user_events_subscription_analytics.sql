-- Analytics: subscription funnel + salon detail clicks
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
      'salon_clicks'
    )
  );
