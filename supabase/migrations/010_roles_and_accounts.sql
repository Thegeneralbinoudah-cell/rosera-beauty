ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'admin', 'supervisor', 'user'));

-- توافق مع إدراجات admins أدناه (لو الأعمدة غير موجودة من قبل)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_supervisor_or_above() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'supervisor'));
$$ LANGUAGE sql SECURITY DEFINER;

-- إضافة owner/admin: بعد إنشاء المستخدمين من Auth (أو تسجيلهم) خذي UUID من Dashboard → Authentication → Users
-- ثم نفّذي في SQL Editor (استبدلي UUID الحقيقي):
--
-- UPDATE profiles SET role = 'owner', full_name = 'Captain Abdul', email = 'captain.abdull@gmail.com' WHERE id = 'uuid-المالك-هنا';
-- INSERT INTO admins (user_id, role) VALUES ('uuid-المالك-هنا', 'owner') ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
--
-- UPDATE profiles SET role = 'admin', full_name = 'Maryam', email = 'mno22.mm@gmail.com' WHERE id = 'uuid-الأدمن-هنا';
-- INSERT INTO admins (user_id, role) VALUES ('uuid-الأدمن-هنا', 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
