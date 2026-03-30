-- Aggregated conversion signals from rozi_events for Edge ranking (no user PII).
-- Callable only with service_role — keeps aggregates off client RLS.

CREATE INDEX IF NOT EXISTS idx_rozi_events_created_action_entity
  ON public.rozi_events (created_at DESC, action_type)
  WHERE entity_id IS NOT NULL AND btrim(entity_id::text) <> '';

CREATE OR REPLACE FUNCTION public.rozy_entity_revenue_signals(p_days integer DEFAULT 30)
RETURNS TABLE (
  entity_kind text,
  entity_id text,
  signal double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT GREATEST(7, LEAST(COALESCE(p_days, 30), 90))::int AS d
  ),
  salon_ev AS (
    SELECT
      e.entity_id::text AS bid,
      count(*) FILTER (WHERE e.action_type = 'book')::bigint AS books,
      count(*) FILTER (WHERE e.action_type = 'salon_detail')::bigint AS details
    FROM public.rozi_events e
    CROSS JOIN params p
    WHERE e.created_at >= now() - make_interval(days => p.d)
      AND e.entity_id IS NOT NULL
      AND btrim(e.entity_id::text) <> ''
      AND e.action_type IN ('book', 'salon_detail')
    GROUP BY 1
  ),
  salon_sig AS (
    SELECT
      'salon'::text AS entity_kind,
      s.bid AS entity_id,
      (
        LEAST(14::double precision, s.books * 3.2 + s.details * 0.35)
        + CASE
            WHEN (s.books + s.details) >= 14 AND s.books = 0 THEN -7::double precision
            ELSE 0::double precision
          END
      ) AS signal
    FROM salon_ev s
    WHERE (s.books + s.details) >= 3
  ),
  prod_ev AS (
    SELECT
      e.entity_id::text AS pid,
      count(*) FILTER (WHERE e.action_type = 'view_product')::bigint AS views,
      count(*) FILTER (WHERE e.action_type IN ('add_to_cart', 'checkout'))::bigint AS adds
    FROM public.rozi_events e
    CROSS JOIN params p
    WHERE e.created_at >= now() - make_interval(days => p.d)
      AND e.entity_id IS NOT NULL
      AND btrim(e.entity_id::text) <> ''
      AND e.action_type IN ('view_product', 'add_to_cart', 'checkout')
    GROUP BY 1
  ),
  prod_sig AS (
    SELECT
      'product'::text AS entity_kind,
      p.pid AS entity_id,
      (
        LEAST(12::double precision, p.adds * 2.5 + p.views * 0.08)
        + CASE
            WHEN p.views >= 28 AND p.adds = 0 THEN -6::double precision
            ELSE 0::double precision
          END
      ) AS signal
    FROM prod_ev p
    WHERE (p.views + p.adds) >= 4
  )
  SELECT salon_sig.entity_kind, salon_sig.entity_id, salon_sig.signal FROM salon_sig
  UNION ALL
  SELECT prod_sig.entity_kind, prod_sig.entity_id, prod_sig.signal FROM prod_sig;
$$;

REVOKE ALL ON FUNCTION public.rozy_entity_revenue_signals(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rozy_entity_revenue_signals(integer) TO service_role;

COMMENT ON FUNCTION public.rozy_entity_revenue_signals IS
  'Rosie funnel aggregates: boost high book/add_to_cart entities; penalize high detail/view with no conversion. Edge + service_role only.';
