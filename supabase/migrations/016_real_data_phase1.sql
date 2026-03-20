-- Phase 1: Real data foundation + full experimental data purge
-- Goal:
-- 1) Separate real vs experimental records explicitly
-- 2) Create provider/shipping foundation for real commerce flow
-- 3) Remove existing experimental records completely (not hidden)

-- -------------------------------------------------------------------
-- Data lineage columns
-- -------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'provider_api', 'legacy_seed'));

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'provider_api', 'legacy_seed'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'provider_api', 'legacy_seed'));

CREATE INDEX IF NOT EXISTS idx_businesses_is_demo ON public.businesses(is_demo);
CREATE INDEX IF NOT EXISTS idx_services_is_demo ON public.services(is_demo);
CREATE INDEX IF NOT EXISTS idx_products_is_demo ON public.products(is_demo);

-- -------------------------------------------------------------------
-- Provider and shipping foundation (Phase 2/3 ready)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  legal_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vat_number TEXT,
  commercial_reg_no TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'imported', 'provider_api')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  provider_sku TEXT,
  cost_price DECIMAL(10,2),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_lead_time_days INTEGER DEFAULT 1,
  max_lead_time_days INTEGER DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.shipping_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  code TEXT UNIQUE,
  api_base_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shipping_partner_id UUID REFERENCES public.shipping_partners(id) ON DELETE SET NULL,
  tracking_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'in_transit', 'delivered', 'failed', 'returned')),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  tracking_url TEXT,
  last_tracking_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_products_provider ON public.provider_products(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_products_product ON public.provider_products(product_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_providers_select" ON public.providers
  FOR SELECT USING (true);
CREATE POLICY "p_provider_products_select" ON public.provider_products
  FOR SELECT USING (true);
CREATE POLICY "p_shipping_partners_select" ON public.shipping_partners
  FOR SELECT USING (true);
CREATE POLICY "p_shipments_select_owner_or_admin" ON public.shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = shipments.order_id
        AND (
          o.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
          )
        )
    )
  );

-- -------------------------------------------------------------------
-- Purge audit + full experimental cleanup
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_purge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  affected_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_products INTEGER := 0;
  v_businesses INTEGER := 0;
BEGIN
  -- Existing dataset in this environment is legacy seed/demo baseline.
  -- Mark it explicitly before deleting so lineage is auditable.
  UPDATE public.products
  SET is_demo = true, source_type = 'legacy_seed'
  WHERE is_demo = false;

  UPDATE public.businesses
  SET is_demo = true, source_type = 'legacy_seed'
  WHERE is_demo = false;

  UPDATE public.services s
  SET is_demo = true, source_type = 'legacy_seed'
  FROM public.businesses b
  WHERE s.business_id = b.id
    AND b.is_demo = true;

  SELECT count(*) INTO v_products FROM public.products WHERE is_demo = true;
  SELECT count(*) INTO v_businesses FROM public.businesses WHERE is_demo = true;

  INSERT INTO public.data_purge_audit(action_key, entity_name, affected_count, note)
  VALUES
    ('phase1_mark_demo', 'products', v_products, 'Marked legacy seeded records as demo'),
    ('phase1_mark_demo', 'businesses', v_businesses, 'Marked legacy seeded records as demo');

  -- Full removal requested: delete demo records, not hide them.
  DELETE FROM public.products WHERE is_demo = true;
  DELETE FROM public.businesses WHERE is_demo = true;

  INSERT INTO public.data_purge_audit(action_key, entity_name, affected_count, note)
  VALUES
    ('phase1_purge_demo', 'products', v_products, 'Deleted demo products completely'),
    ('phase1_purge_demo', 'businesses', v_businesses, 'Deleted demo businesses and cascading dependencies');
END $$;
