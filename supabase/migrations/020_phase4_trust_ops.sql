-- Phase 4: Trust and operations visibility

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_flags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS expected_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_risk_score ON public.orders(risk_score);
CREATE INDEX IF NOT EXISTS idx_shipments_sla_breached ON public.shipments(sla_breached);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_order_events_select" ON public.order_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_events.order_id
        AND (
          o.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
          )
        )
    )
  );

CREATE POLICY "p_order_events_admin_insert" ON public.order_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_orders_admin_risk_update" ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );
