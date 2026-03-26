-- Allow platform staff to read all salon_subscriptions (admin monetization dashboards)
CREATE POLICY "salon_subscriptions_select_staff"
  ON public.salon_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'owner', 'supervisor')
    )
  );

COMMENT ON POLICY "salon_subscriptions_select_staff" ON public.salon_subscriptions IS
  'Staff roles can list subscription rows for revenue / MRR dashboards.';
