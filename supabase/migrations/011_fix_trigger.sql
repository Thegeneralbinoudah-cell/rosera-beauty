-- إصلاح trigger إنشاء المستخدم: توافق مع profiles_role_check وتجنب أخطاء القيود
-- السبب: القيمة الافتراضية القديمة كانت 'customer' والـ constraint يسمح فقط بـ owner, admin, supervisor, user

-- توحيد القيمة الافتراضية لـ role
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

-- تحويل أي سجلات قديمة من customer إلى user
UPDATE public.profiles SET role = 'user' WHERE role IS NULL OR role = 'customer' OR role NOT IN ('owner', 'admin', 'supervisor', 'user');

-- استبدال الدالة لتعيين role صراحة وتجنب NULL في الحقول
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_code TEXT;
BEGIN
  inv_code := upper(substring(md5(random()::text || NEW.id::text) from 1 for 12));
  INSERT INTO public.profiles (id, email, full_name, invite_code, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    inv_code,
    'user'
  );
  RETURN NEW;
END;
$$;
