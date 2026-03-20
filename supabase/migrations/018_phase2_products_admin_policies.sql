-- Phase 2.1: Product onboarding policies for admin dashboard

CREATE POLICY "p_products_select_admin_all" ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_products_admin_insert" ON public.products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

CREATE POLICY "p_products_admin_update" ON public.products
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

CREATE POLICY "p_products_admin_delete" ON public.products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );
