CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created ON public.otp_codes(phone, created_at DESC);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.phone_auth_users (
  phone text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  internal_email text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.phone_auth_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.salon_owners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role text DEFAULT 'owner',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, salon_id)
);
CREATE INDEX IF NOT EXISTS idx_salon_owners_user ON public.salon_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_salon_owners_salon ON public.salon_owners(salon_id);
ALTER TABLE public.salon_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salon_owners_select_own" ON public.salon_owners FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.admins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_select_self" ON public.admins FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
