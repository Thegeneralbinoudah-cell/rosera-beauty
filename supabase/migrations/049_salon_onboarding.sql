-- Salon onboarding: normalized tables + RPC (single transaction) + storage buckets

-- ---------------------------------------------------------------------------
-- salon_settings: booking UX columns (keep existing payment_method for Moyasar)
-- ---------------------------------------------------------------------------
ALTER TABLE public.salon_settings
  ADD COLUMN IF NOT EXISTS confirmation_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS booking_payment_mode text NOT NULL DEFAULT 'app';

ALTER TABLE public.salon_settings DROP CONSTRAINT IF EXISTS salon_settings_confirmation_type_check;
ALTER TABLE public.salon_settings
  ADD CONSTRAINT salon_settings_confirmation_type_check
  CHECK (confirmation_type IN ('instant', 'manual'));

ALTER TABLE public.salon_settings DROP CONSTRAINT IF EXISTS salon_settings_booking_payment_mode_check;
ALTER TABLE public.salon_settings
  ADD CONSTRAINT salon_settings_booking_payment_mode_check
  CHECK (booking_payment_mode IN ('app', 'venue', 'both'));

-- ---------------------------------------------------------------------------
-- Core tables (salon_id = businesses.id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salons (
  id uuid PRIMARY KEY REFERENCES public.businesses (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salon_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time,
  close_time time,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_salon_hours_salon ON public.salon_hours (salon_id);

CREATE TABLE IF NOT EXISTS public.salon_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  category text NOT NULL CHECK (category IN ('hair', 'nails', 'body', 'face', 'bridal')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_services_salon ON public.salon_services (salon_id);

CREATE TABLE IF NOT EXISTS public.salon_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name_ar text NOT NULL,
  role_ar text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_team_salon ON public.salon_team (salon_id);

CREATE TABLE IF NOT EXISTS public.salon_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('portfolio', 'photo')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salon_media_salon ON public.salon_media (salon_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salons_select_owner" ON public.salons;
CREATE POLICY "salons_select_owner" ON public.salons FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = salons.id AND b.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "salons_mutate_owner" ON public.salons;
CREATE POLICY "salons_mutate_owner" ON public.salons FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "salon_hours_all_owner" ON public.salon_hours;
CREATE POLICY "salon_hours_all_owner" ON public.salon_hours FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_hours.salon_id AND b.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_hours.salon_id AND b.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "salon_services_all_owner" ON public.salon_services;
CREATE POLICY "salon_services_all_owner" ON public.salon_services FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_services.salon_id AND b.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_services.salon_id AND b.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "salon_team_all_owner" ON public.salon_team;
CREATE POLICY "salon_team_all_owner" ON public.salon_team FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_team.salon_id AND b.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_team.salon_id AND b.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "salon_media_all_owner" ON public.salon_media;
CREATE POLICY "salon_media_all_owner" ON public.salon_media FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_media.salon_id AND b.owner_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_media.salon_id AND b.owner_id = auth.uid()
  )
);

-- Allow linking self as salon owner after creating the business (client path fallback)
DROP POLICY IF EXISTS "salon_owners_insert_self" ON public.salon_owners;
CREATE POLICY "salon_owners_insert_self" ON public.salon_owners FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = salon_id AND b.owner_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- Storage: salon-portfolio, salon-photos
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('salon-portfolio', 'salon-portfolio', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('salon-photos', 'salon-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "salon_portfolio_select" ON storage.objects;
CREATE POLICY "salon_portfolio_select" ON storage.objects FOR SELECT
USING (bucket_id = 'salon-portfolio');

DROP POLICY IF EXISTS "salon_portfolio_insert" ON storage.objects;
CREATE POLICY "salon_portfolio_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'salon-portfolio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "salon_portfolio_update" ON storage.objects;
CREATE POLICY "salon_portfolio_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'salon-portfolio' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'salon-portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "salon_portfolio_delete" ON storage.objects;
CREATE POLICY "salon_portfolio_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'salon-portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "salon_photos_select" ON storage.objects;
CREATE POLICY "salon_photos_select" ON storage.objects FOR SELECT
USING (bucket_id = 'salon-photos');

DROP POLICY IF EXISTS "salon_photos_insert" ON storage.objects;
CREATE POLICY "salon_photos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'salon-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "salon_photos_update" ON storage.objects;
CREATE POLICY "salon_photos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'salon-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'salon-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "salon_photos_delete" ON storage.objects;
CREATE POLICY "salon_photos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'salon-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Atomic onboarding (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_salon_onboarding (payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_basic jsonb;
  v_media jsonb;
  v_settings jsonb;
  v_opening jsonb := '{}'::jsonb;
  h jsonb;
  s jsonb;
  t jsonb;
  m jsonb;
  v_pay text;
  v_pm text;
  v_cov text;
  v_logo text;
  v_imgs text[] := ARRAY[]::text[];
  v_sort int := 0;
  v_day text;
  v_svc_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_basic := payload->'basic';
  IF v_basic IS NULL OR jsonb_typeof(v_basic) <> 'object' THEN
    RAISE EXCEPTION 'invalid_basic';
  END IF;

  IF length(trim(COALESCE(v_basic->>'name_ar', ''))) < 2 THEN
    RAISE EXCEPTION 'name_ar_required';
  END IF;

  IF length(trim(COALESCE(v_basic->>'city', ''))) < 1 THEN
    RAISE EXCEPTION 'city_required';
  END IF;

  SELECT count(*) INTO v_svc_count
  FROM jsonb_array_elements(COALESCE(payload->'services', '[]'::jsonb)) AS x;

  IF v_svc_count < 1 THEN
    RAISE EXCEPTION 'services_required';
  END IF;

  v_media := COALESCE(payload->'media', '{}'::jsonb);
  v_cov := NULLIF(trim(COALESCE(v_media->>'cover_image', '')), '');
  IF v_cov IS NULL OR length(v_cov) < 8 THEN
    RAISE EXCEPTION 'cover_required';
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'hours', '[]'::jsonb))
  LOOP
    v_day := h->>'day';
    IF v_day IS NULL THEN
      CONTINUE;
    END IF;
    IF COALESCE((h->>'closed')::boolean, false) THEN
      v_opening := v_opening || jsonb_build_object(v_day, jsonb_build_object('closed', true));
    ELSE
      v_opening := v_opening || jsonb_build_object(
        v_day,
        jsonb_build_object(
          'open', COALESCE(NULLIF(trim(COALESCE(h->>'open', '')), ''), '09:00'),
          'close', COALESCE(NULLIF(trim(COALESCE(h->>'close', '')), ''), '21:00')
        )
      );
    END IF;
  END LOOP;

  v_logo := NULLIF(trim(COALESCE(v_media->>'logo', '')), '');
  v_imgs := ARRAY[v_cov];
  IF v_logo IS NOT NULL AND length(v_logo) > 4 THEN
    v_imgs := array_append(v_imgs, v_logo);
  END IF;

  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(v_media->'portfolio', '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(m->>'url', ''))) > 8 THEN
      v_imgs := array_append(v_imgs, trim(m->>'url'));
    END IF;
  END LOOP;

  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(v_media->'photos', '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(m->>'url', ''))) > 8 THEN
      v_imgs := array_append(v_imgs, trim(m->>'url'));
    END IF;
  END LOOP;

  INSERT INTO public.businesses (
    owner_id,
    name_ar,
    description_ar,
    category,
    category_label,
    city,
    region,
    address_ar,
    latitude,
    longitude,
    phone,
    whatsapp,
    cover_image,
    logo,
    images,
    opening_hours,
    is_active,
    is_verified,
    is_demo,
    source_type
  )
  VALUES (
    v_uid,
    trim(v_basic->>'name_ar'),
    NULLIF(trim(COALESCE(v_basic->>'description_ar', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(v_basic->>'category', '')), ''), 'salon'),
    NULLIF(trim(COALESCE(v_basic->>'category_label', '')), ''),
    trim(v_basic->>'city'),
    NULLIF(trim(COALESCE(v_basic->>'region', '')), ''),
    NULLIF(trim(COALESCE(v_basic->>'address_ar', '')), ''),
    (v_basic->>'latitude')::double precision,
    (v_basic->>'longitude')::double precision,
    NULLIF(trim(COALESCE(v_basic->>'phone', '')), ''),
    NULLIF(trim(COALESCE(v_basic->>'whatsapp', '')), ''),
    v_cov,
    v_logo,
    v_imgs,
    v_opening,
    true,
    false,
    false,
    'manual'
  )
  RETURNING id INTO v_business_id;

  INSERT INTO public.salon_owners (user_id, salon_id, role)
  VALUES (v_uid, v_business_id, 'owner');

  INSERT INTO public.salons (id, owner_id)
  VALUES (v_business_id, v_uid);

  FOR h IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'hours', '[]'::jsonb))
  LOOP
    INSERT INTO public.salon_hours (salon_id, day_of_week, open_time, close_time, is_closed)
    VALUES (
      v_business_id,
      (h->>'day')::smallint,
      CASE WHEN COALESCE((h->>'closed')::boolean, false) THEN NULL ELSE (NULLIF(trim(COALESCE(h->>'open', '')), ''))::time END,
      CASE WHEN COALESCE((h->>'closed')::boolean, false) THEN NULL ELSE (NULLIF(trim(COALESCE(h->>'close', '')), ''))::time END,
      COALESCE((h->>'closed')::boolean, false)
    );
  END LOOP;

  FOR s IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'services', '[]'::jsonb))
  LOOP
    INSERT INTO public.salon_services (salon_id, name_ar, category, price, duration_minutes)
    VALUES (
      v_business_id,
      trim(s->>'name_ar'),
      trim(s->>'category'),
      (s->>'price')::numeric,
      (s->>'duration_minutes')::integer
    );

    INSERT INTO public.services (
      business_id,
      name_ar,
      category,
      price,
      duration_minutes,
      is_active,
      is_demo,
      source_type
    )
    VALUES (
      v_business_id,
      trim(s->>'name_ar'),
      trim(s->>'category'),
      (s->>'price')::numeric,
      (s->>'duration_minutes')::integer,
      true,
      false,
      'manual'
    );
  END LOOP;

  v_sort := 0;
  FOR t IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'team', '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(t->>'name_ar', ''))) < 1 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.salon_team (salon_id, name_ar, role_ar, image_url, sort_order)
    VALUES (
      v_business_id,
      trim(t->>'name_ar'),
      NULLIF(trim(COALESCE(t->>'role_ar', '')), ''),
      NULLIF(trim(COALESCE(t->>'image_url', '')), ''),
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  v_sort := 0;
  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(v_media->'portfolio', '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(m->>'url', ''))) < 8 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.salon_media (salon_id, url, kind, sort_order)
    VALUES (
      v_business_id,
      trim(m->>'url'),
      'portfolio',
      COALESCE((m->>'sort_order')::integer, v_sort)
    );
    v_sort := v_sort + 1;
  END LOOP;

  v_sort := 0;
  FOR m IN SELECT * FROM jsonb_array_elements(COALESCE(v_media->'photos', '[]'::jsonb))
  LOOP
    IF length(trim(COALESCE(m->>'url', ''))) < 8 THEN
      CONTINUE;
    END IF;
    INSERT INTO public.salon_media (salon_id, url, kind, sort_order)
    VALUES (
      v_business_id,
      trim(m->>'url'),
      'photo',
      COALESCE((m->>'sort_order')::integer, v_sort)
    );
    v_sort := v_sort + 1;
  END LOOP;

  v_settings := COALESCE(payload->'settings', '{}'::jsonb);
  v_pay := lower(trim(COALESCE(v_settings->>'booking_payment_mode', 'app')));
  IF v_pay NOT IN ('app', 'venue', 'both') THEN
    v_pay := 'app';
  END IF;
  v_pm := CASE WHEN v_pay = 'venue' THEN 'cash' ELSE 'moyasar' END;

  INSERT INTO public.salon_settings (
    business_id,
    payment_method,
    confirmation_type,
    booking_payment_mode
  )
  VALUES (
    v_business_id,
    v_pm,
    CASE WHEN lower(trim(COALESCE(v_settings->>'confirmation_type', 'manual'))) = 'instant' THEN 'instant' ELSE 'manual' END,
    v_pay
  )
  ON CONFLICT (business_id) DO UPDATE SET
    payment_method = EXCLUDED.payment_method,
    confirmation_type = EXCLUDED.confirmation_type,
    booking_payment_mode = EXCLUDED.booking_payment_mode,
    updated_at = now();

  RETURN v_business_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_salon_onboarding (jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_salon_onboarding (jsonb) TO authenticated;
