-- Phase 3: Shipping operations constraints + policies

-- One shipment per order (simplifies operations and tracking view)
CREATE UNIQUE INDEX IF NOT EXISTS ux_shipments_order_id ON public.shipments(order_id);

-- Admin/owner/supervisor can create shipment records
CREATE POLICY "p_shipments_admin_insert" ON public.shipments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

-- Admin/owner/supervisor can view all orders for shipping ops
CREATE POLICY "p_orders_admin_select" ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );

-- Admin/owner/supervisor can update order status in operations flow
CREATE POLICY "p_orders_admin_update" ON public.orders
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

-- Admin/owner/supervisor can inspect order items for operations
CREATE POLICY "p_order_items_admin_select" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner', 'supervisor')
    )
  );
