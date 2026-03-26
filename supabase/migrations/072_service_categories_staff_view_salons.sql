-- Aligns with a "salon catalog" domain model without duplicating core tables.
-- Canonical salon row remains public.businesses (id). salon_id = businesses.id everywhere below.
--
-- 049_salon_onboarding creates TABLE public.salons (owner link rows). This migration needs the name
-- public.salons for a read-only VIEW; rename the onboarding table first.

DO $salon_rename$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'salons'
      AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.salons RENAME TO salon_onboarding;
    COMMENT ON TABLE public.salon_onboarding IS
      'Onboarding-only link: business id + owner. Catalog projection is public.salons (view).';
  END IF;
END
$salon_rename$;

-- ---------------------------------------------------------------------------
-- Optional read model: salons view (rating/city/district/images from businesses)
-- distance_km / is_open / next_open_time stay client-computed or null here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.salons AS
SELECT
  b.id,
  b.name_en AS name,
  b.name_ar,
  b.average_rating::numeric AS rating,
  b.total_reviews AS review_count,
  NULL::numeric AS distance_km,
  NULLIF(trim(split_part(COALESCE(b.address_ar, ''), '،', 1)), '') AS district,
  COALESCE(sc.name_ar, b.city) AS city,
  NULL::boolean AS is_open,
  NULL::text AS next_open_time,
  b.images
FROM public.businesses b
LEFT JOIN public.sa_cities sc ON sc.id = b.city_id;

COMMENT ON VIEW public.salons IS 'Read-only projection of businesses for salon-shaped APIs; use businesses for writes.';

-- ---------------------------------------------------------------------------
-- SERVICE CATEGORIES (per salon)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name text,
  name_ar text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_salon ON public.service_categories (salon_id);

-- ---------------------------------------------------------------------------
-- SERVICES: optional FK to service_categories + price range (keeps legacy price)
-- ---------------------------------------------------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_from numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_to numeric(10, 2);

COMMENT ON COLUMN public.services.category_id IS 'Optional normalized category; legacy services.category text may still be set.';
COMMENT ON COLUMN public.services.price_from IS 'Optional range low; when null, use price.';
COMMENT ON COLUMN public.services.price_to IS 'Optional range high; when null, use price.';

-- ---------------------------------------------------------------------------
-- STAFF (customer-facing team; distinct from salon_team owner onboarding table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name text,
  name_ar text,
  specialty text,
  specialty_ar text,
  rating numeric(3, 2),
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_salon ON public.staff (salon_id);

-- ---------------------------------------------------------------------------
-- BOOKINGS: optional staff assignment
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_staff ON public.bookings (staff_id) WHERE staff_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_categories_select_public" ON public.service_categories;
CREATE POLICY "service_categories_select_public" ON public.service_categories FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = service_categories.salon_id
      AND COALESCE(b.is_active, true) = true
      AND COALESCE(b.is_demo, false) = false
  )
);

DROP POLICY IF EXISTS "service_categories_owner_all" ON public.service_categories;
CREATE POLICY "service_categories_owner_all" ON public.service_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_categories.salon_id AND b.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_categories.salon_id AND b.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "staff_select_public" ON public.staff;
CREATE POLICY "staff_select_public" ON public.staff FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = staff.salon_id
      AND COALESCE(b.is_active, true) = true
      AND COALESCE(b.is_demo, false) = false
  )
);

DROP POLICY IF EXISTS "staff_owner_all" ON public.staff;
CREATE POLICY "staff_owner_all" ON public.staff FOR ALL USING (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = staff.salon_id AND b.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = staff.salon_id AND b.owner_id = auth.uid())
);

-- Views: allow anon read of salons projection (inherits from underlying businesses SELECT policy)
GRANT SELECT ON public.salons TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- complete_salon_onboarding referenced TABLE public.salons (renamed above)
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

  INSERT INTO public.salon_onboarding (id, owner_id)
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
