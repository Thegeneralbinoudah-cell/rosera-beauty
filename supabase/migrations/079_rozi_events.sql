-- Rosie chat action / conversion tracking (Supabase)
CREATE TABLE IF NOT EXISTS public.rozi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (
    action_type IN ('book', 'salon_detail', 'view_product', 'add_to_cart', 'checkout')
  ),
  entity_id text NULL,
  recommendation_mode text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rozi_events_user_created
  ON public.rozi_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rozi_events_action_created
  ON public.rozi_events (action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rozi_events_mode_created
  ON public.rozi_events (recommendation_mode, created_at DESC)
  WHERE recommendation_mode IS NOT NULL;

ALTER TABLE public.rozi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rozi_events_select_own"
  ON public.rozi_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "rozi_events_insert_own"
  ON public.rozi_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "rozi_events_select_admin_team"
  ON public.rozi_events FOR SELECT
  USING (public.is_privileged_staff());

COMMENT ON TABLE public.rozi_events IS
  'Rosie (Rozi) chat CTAs: book, salon detail, product view, cart, checkout — for funnel analytics.';
