-- Phase 2: Admin/owner management policies for providers and supply links

-- Admin-like role helper expression reused in policies:
-- role in ('admin','owner','supervisor')

CREATE POLICY "p_providers_admin_insert" ON public.providers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_providers_admin_update" ON public.providers
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

CREATE POLICY "p_provider_products_admin_insert" ON public.provider_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_provider_products_admin_update" ON public.provider_products
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

CREATE POLICY "p_shipping_partners_admin_insert" ON public.shipping_partners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_shipping_partners_admin_update" ON public.shipping_partners
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

CREATE POLICY "p_shipments_admin_update" ON public.shipments
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
