-- Profiles: remove open SELECT; own + staff; safe public view for names/avatars
-- Bookings: performance indexes

-- Avoid RLS recursion when checking staff role (profiles referencing profiles)
CREATE OR REPLACE FUNCTION public.is_privileged_staff ()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.admins
      WHERE
        user_id = auth.uid())
    OR EXISTS (
      SELECT
        1
      FROM
        public.profiles p
      WHERE
        p.id = auth.uid()
        AND (lower(COALESCE(p.role, '')) IN ('admin', 'supervisor', 'owner')
          OR COALESCE(p.email, '') = 'admin@rosera.com'));
$$;

REVOKE ALL ON FUNCTION public.is_privileged_staff () FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_privileged_staff () TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_privileged_staff () TO service_role;

DROP POLICY IF EXISTS "p_profiles_select" ON public.profiles;

CREATE POLICY "p_profiles_select_own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "p_profiles_select_admin_team" ON public.profiles
  FOR SELECT
  USING (public.is_privileged_staff());

-- Safe directory (no email/phone). security_invoker = false: invokers read via view owner (bypasses RLS on profiles for this SELECT only).
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = FALSE) AS
SELECT
  id,
  full_name,
  avatar_url
FROM
  public.profiles;

COMMENT ON VIEW public.public_profiles IS 'Public display: id, full_name, avatar_url. Use instead of profiles for cross-user UI.';

GRANT SELECT ON public.public_profiles TO anon;

GRANT SELECT ON public.public_profiles TO authenticated;

GRANT SELECT ON public.public_profiles TO service_role;

-- 049 duplicate schema — not used by app (isolation / documentation)
DO $$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = 'salons') THEN
    COMMENT ON TABLE public.salons IS 'DEPRECATED (049): app uses businesses + services.';
  END IF;
  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = 'salon_services') THEN
    COMMENT ON TABLE public.salon_services IS 'DEPRECATED (049): app uses public.services.';
  END IF;
  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = 'salon_team') THEN
    COMMENT ON TABLE public.salon_team IS 'DEPRECATED (049): unused by app.';
  END IF;
  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.tables
    WHERE
      table_schema = 'public'
      AND table_name = 'salon_media') THEN
    COMMENT ON TABLE public.salon_media IS 'DEPRECATED (049): unused by app.';
  END IF;
END
$$;

-- Booking list performance
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON public.bookings (business_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id_created ON public.bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings (payment_status);
