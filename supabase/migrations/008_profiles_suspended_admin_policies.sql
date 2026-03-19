-- تعطيل المستخدمين من لوحة الأدمن
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

CREATE POLICY "p_profiles_admin_suspend" ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.email = 'admin@rosera.com')
    )
  );
