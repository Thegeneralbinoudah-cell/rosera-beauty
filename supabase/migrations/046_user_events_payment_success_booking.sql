-- payment_success analytics + booking as entity_type for revenue events
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
      'payment_success'
    )
  );

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'public.user_events'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%entity_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.user_events
  ADD CONSTRAINT user_events_entity_type_check
  CHECK (entity_type IN ('service', 'product', 'business', 'booking'));
