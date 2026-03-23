-- =============================================================================
-- ROSERA — DESTRUCTIVE RESET: wipe all businesses and dependent rows
-- =============================================================================
-- Use ONLY on dev/staging or when you intentionally purge catalog data.
-- TRUNCATE ... CASCADE removes rows in tables that reference public.businesses
-- (services, bookings, reviews, favorites, offers, blocked slots, etc.).
--
-- After this, run: master_seed.sql (or your own seed).
-- =============================================================================

BEGIN;

TRUNCATE TABLE public.businesses CASCADE;

COMMIT;
