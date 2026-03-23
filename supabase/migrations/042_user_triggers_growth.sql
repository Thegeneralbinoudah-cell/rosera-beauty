-- Growth engine: queued triggers → AI copy → notifications (max 1 growth notif / user / day in app logic)

CREATE TABLE IF NOT EXISTS public.user_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (
    trigger_type IN ('inactive', 'viewed_not_booked', 'new_offer', 'skin_followup')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_triggers_user_processed ON public.user_triggers (user_id, processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_triggers_open ON public.user_triggers (processed, created_at) WHERE processed = false;

-- One unprocessed row per (user, trigger_type) to avoid queue spam
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_triggers_pending_type
  ON public.user_triggers (user_id, trigger_type)
  WHERE processed = false;

ALTER TABLE public.user_triggers ENABLE ROW LEVEL SECURITY;

-- No policies: clients cannot read/write; service_role bypasses RLS for Edge Functions.

-- Users engaged before but no user_events in the last 7 days
CREATE OR REPLACE FUNCTION public.growth_detect_inactive_users ()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id
  FROM public.profiles p
  WHERE (
    EXISTS (SELECT 1 FROM public.user_events ue WHERE ue.user_id = p.id)
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.user_id = p.id)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_events ue2
    WHERE ue2.user_id = p.id
      AND ue2.created_at > now() - interval '7 days'
  );
$$;

REVOKE ALL ON FUNCTION public.growth_detect_inactive_users () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_detect_inactive_users () TO service_role;

-- Viewed/clicked a service in 14d but no booking for that service after the last such event
CREATE OR REPLACE FUNCTION public.growth_detect_viewed_not_booked ()
RETURNS TABLE (
  user_id uuid,
  service_id uuid,
  business_id uuid,
  service_name text,
  last_event_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    SELECT
      ue.user_id AS uid,
      ue.entity_id AS sid,
      max(ue.created_at) AS last_at
    FROM public.user_events ue
    WHERE ue.entity_type = 'service'
      AND ue.event_type IN ('view', 'click')
      AND ue.created_at > now() - interval '14 days'
    GROUP BY ue.user_id, ue.entity_id
  )
  SELECT
    v.uid,
    v.sid,
    s.business_id,
    s.name_ar,
    v.last_at
  FROM v
  INNER JOIN public.services s ON s.id = v.sid
  WHERE COALESCE(s.is_active, true) = true
    AND COALESCE(s.is_demo, false) = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.user_id = v.uid
        AND b.created_at >= v.last_at
        AND (
          b.service_id = v.sid
          OR v.sid = ANY (COALESCE(b.service_ids, '{}'))
        )
    );
$$;

REVOKE ALL ON FUNCTION public.growth_detect_viewed_not_booked () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_detect_viewed_not_booked () TO service_role;

-- Latest skin analysis row is older than 14 days
CREATE OR REPLACE FUNCTION public.growth_detect_skin_followup ()
RETURNS TABLE (
  user_id uuid,
  analysis_id uuid,
  analyzed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.user_id, sa.id, sa.created_at
  FROM public.skin_analysis sa
  INNER JOIN (
    SELECT sa2.user_id AS uid, max(sa2.created_at) AS mx
    FROM public.skin_analysis sa2
    WHERE sa2.user_id IS NOT NULL
    GROUP BY sa2.user_id
  ) t ON sa.user_id = t.uid AND sa.created_at = t.mx
  WHERE sa.created_at < now() - interval '14 days';
$$;

REVOKE ALL ON FUNCTION public.growth_detect_skin_followup () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_detect_skin_followup () TO service_role;

-- Recent active offers in businesses matching the user's profile city (text match)
CREATE OR REPLACE FUNCTION public.growth_detect_offer_user_pairs ()
RETURNS TABLE (
  user_id uuid,
  offer_id uuid,
  business_id uuid,
  city text,
  title_ar text,
  discount_percentage integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    o.id,
    b.id,
    b.city,
    o.title_ar,
    o.discount_percentage
  FROM public.offers o
  INNER JOIN public.businesses b
    ON b.id = o.business_id
    AND COALESCE(b.is_active, true) = true
    AND COALESCE(b.is_demo, false) = false
  INNER JOIN public.profiles p
    ON trim(lower(COALESCE(p.city, ''))) = trim(lower(COALESCE(b.city, '')))
    AND trim(COALESCE(p.city, '')) <> ''
  WHERE COALESCE(o.is_active, true) = true
    AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
    AND (o.start_date IS NULL OR o.start_date <= CURRENT_DATE)
    AND o.created_at > now() - interval '5 days';
$$;

REVOKE ALL ON FUNCTION public.growth_detect_offer_user_pairs () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_detect_offer_user_pairs () TO service_role;
