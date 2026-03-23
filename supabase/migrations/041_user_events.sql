-- Signals for recommendation ranking (views, clicks, explicit books from UI)
CREATE TABLE IF NOT EXISTS public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'click', 'book')),
  entity_type text NOT NULL CHECK (entity_type IN ('service', 'product', 'business')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON public.user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_entity ON public.user_events (entity_type, entity_id);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_events_select_own"
  ON public.user_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_events_insert_own"
  ON public.user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
