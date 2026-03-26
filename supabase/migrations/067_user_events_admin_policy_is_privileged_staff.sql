-- Align user_events admin SELECT with public.is_privileged_staff() (same as profiles staff access, migration 063)

DROP POLICY IF EXISTS "user_events_select_admin_team" ON public.user_events;

CREATE POLICY "user_events_select_admin_team"
  ON public.user_events FOR SELECT
  USING (public.is_privileged_staff());

COMMENT ON POLICY "user_events_select_admin_team" ON public.user_events IS
  'Staff analytics: matches is_privileged_staff (admins table or profiles role admin/supervisor/owner or admin@rosera.com).';
