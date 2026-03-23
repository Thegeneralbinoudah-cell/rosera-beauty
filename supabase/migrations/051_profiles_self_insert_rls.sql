-- السماح للمستخدم المسجّل بإنشاء صفه في profiles عند غيابه (مثلاً فشل الـ trigger أو مستخدم قديم)
-- مطلوب لـ FK من chat_messages.user_id → profiles.id

DROP POLICY IF EXISTS "p_profiles_insert_own" ON public.profiles;

CREATE POLICY "p_profiles_insert_own" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
