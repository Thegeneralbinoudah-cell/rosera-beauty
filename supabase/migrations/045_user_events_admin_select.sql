-- Allow admin team to read all user_events (analytics dashboard)
DROP POLICY IF EXISTS "user_events_select_admin_team" ON public.user_events;

CREATE POLICY "user_events_select_admin_team"
  ON public.user_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('owner', 'admin', 'supervisor')
    )
  );
