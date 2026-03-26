-- SAFE: performance indexes + non-destructive documentation
-- Skips duplicates already created in 041, 063, 066 (user_events user+created, event_type+created_at DESC, bookings user+created).

-- =============================================================================
-- SAFE: Bookings (salon calendar + admin sort)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_business_status_booking_date
  ON public.bookings (business_id, status, booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at_desc
  ON public.bookings (created_at DESC);

-- =============================================================================
-- SAFE: user_events (admin time-range; event_type+created_at covered by 066)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_events_created_at_desc
  ON public.user_events (created_at DESC);

-- =============================================================================
-- SAFE: businesses / products / reviews
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_businesses_city_id_is_active
  ON public.businesses (city_id, is_active);

CREATE INDEX IF NOT EXISTS idx_products_category_is_active
  ON public.products (category, is_active);

CREATE INDEX IF NOT EXISTS idx_reviews_business_id
  ON public.reviews (business_id);

-- =============================================================================
-- SAFE: orders (admin / analytics by time)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders (created_at DESC);

-- =============================================================================
-- OPTIONAL: geo / map (btree on lat/lng — not a PostGIS geospatial index)
-- =============================================================================

-- CREATE INDEX IF NOT EXISTS idx_businesses_latitude_longitude
--   ON public.businesses (latitude, longitude);

-- =============================================================================
-- SAFE: Analytics documentation (does not alter CHECK constraints)
-- =============================================================================

COMMENT ON TABLE public.user_events IS
  'Product analytics. Allowed event_type / entity_type values are enforced by user_events_event_type_check and user_events_entity_type_check; coordinate app inserts with those constraints.';

COMMENT ON COLUMN public.user_events.event_type IS
  'See CHECK user_events_event_type_check (widened in migrations 044–066).';

COMMENT ON COLUMN public.user_events.entity_type IS
  'See CHECK user_events_entity_type_check.';

-- =============================================================================
-- OPTIONAL: payment integrity (NOT RUN — verify data first)
-- =============================================================================

-- Audit violating rows before any constraint:
-- SELECT id, payment_status, payment_id FROM public.bookings
--   WHERE payment_status = 'paid' AND payment_id IS NULL;
-- SELECT id, payment_status, payment_id FROM public.orders
--   WHERE payment_status = 'paid' AND payment_id IS NULL;
-- Note: payment_id = '' is NOT NULL in SQL; clean empty strings if you enforce.

-- ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_paid_requires_payment_id;
-- ALTER TABLE public.bookings ADD CONSTRAINT bookings_paid_requires_payment_id
--   CHECK (payment_status <> 'paid' OR payment_id IS NOT NULL);

-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_paid_requires_payment_id;
-- ALTER TABLE public.orders ADD CONSTRAINT orders_paid_requires_payment_id
--   CHECK (payment_status <> 'paid' OR payment_id IS NOT NULL);

-- =============================================================================
-- COMMENT ONLY: data integrity (no schema change)
-- =============================================================================

-- booking_date is already NOT NULL in 001_schema; no ALTER needed.
-- Additional payment/booking invariants: REQUIRES DATA AUDIT before DB enforcement.

-- =============================================================================
-- SAFE: Legacy / canonical geography tables (non-destructive)
-- =============================================================================

COMMENT ON TABLE public.cities IS 'LEGACY — replaced by sa_cities (+ sa_regions) for regional data.';

COMMENT ON TABLE public.sa_cities IS 'Canonical cities; join to sa_regions.';

COMMENT ON TABLE public.sa_regions IS 'Canonical regions.';

-- =============================================================================
-- COMMENT ONLY: RLS (policies unchanged)
-- =============================================================================

-- Review policies when changing user_events or profiles access; avoid ad-hoc role checks
-- that diverge from public.is_privileged_staff() (see migrations 063, 067).
