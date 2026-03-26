-- =============================================================================
-- PAYMENT VERIFICATION AUDIT (read-only + documentation)
-- Run in Supabase SQL Editor. Does not modify data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) SAFE: Invalid paid bookings (missing or blank payment_id)
-- -----------------------------------------------------------------------------

-- SAFE
SELECT
  id,
  payment_status,
  payment_id,
  created_at
FROM public.bookings
WHERE payment_status = 'paid'
  AND (
    payment_id IS NULL
    OR trim(payment_id) = ''
  )
ORDER BY created_at DESC;

-- -----------------------------------------------------------------------------
-- 2) SAFE: Invalid paid orders (missing or blank payment_id)
-- -----------------------------------------------------------------------------

-- SAFE
SELECT
  id,
  payment_status,
  payment_id,
  created_at
FROM public.orders
WHERE payment_status = 'paid'
  AND (
    payment_id IS NULL
    OR trim(payment_id) = ''
  )
ORDER BY created_at DESC;

-- -----------------------------------------------------------------------------
-- 3) OPTIONAL: Count summaries for dashboards
-- -----------------------------------------------------------------------------

-- SAFE
SELECT
  count(*) AS invalid_paid_bookings
FROM public.bookings
WHERE payment_status = 'paid'
  AND (payment_id IS NULL OR trim(payment_id) = '');

-- SAFE
SELECT
  count(*) AS invalid_paid_orders
FROM public.orders
WHERE payment_status = 'paid'
  AND (payment_id IS NULL OR trim(payment_id) = '');

-- -----------------------------------------------------------------------------
-- 4) OPTIONAL — manual remediation ideas (DO NOT run blindly)
-- Review each row; choose one strategy per business rules.
-- -----------------------------------------------------------------------------

-- COMMENT ONLY — Example: mark booking paid-without-id as failed (only if acceptable)
-- UPDATE public.bookings
-- SET payment_status = 'failed', updated_at = now()
-- WHERE id = '<uuid>' AND payment_status = 'paid' AND (payment_id IS NULL OR trim(payment_id) = '');

-- COMMENT ONLY — Example: revert to pending for manual ops follow-up
-- UPDATE public.bookings
-- SET payment_status = 'pending', updated_at = now()
-- WHERE id = '<uuid>' AND payment_status = 'paid' AND (payment_id IS NULL OR trim(payment_id) = '');

-- COMMENT ONLY — Same patterns apply to public.orders with appropriate status columns.

-- -----------------------------------------------------------------------------
-- 5) OPTIONAL — DB constraint (apply only when verification queries return 0 rows)
-- See also: optional_payment_booking_invariants.sql
-- -----------------------------------------------------------------------------

-- OPTIONAL — Run only after: SELECT returns zero invalid rows for bookings AND orders.
-- WARNING: payment_id = '' is NOT NULL; constraint below allows empty string unless you clean data first.
-- Consider: OR trim(payment_id) <> '' in a CHECK, or normalize empty strings to NULL app-side.

-- ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_paid_requires_payment_id;
-- ALTER TABLE public.bookings ADD CONSTRAINT bookings_paid_requires_payment_id
--   CHECK (payment_status <> 'paid' OR (payment_id IS NOT NULL AND trim(payment_id) <> ''));

-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_paid_requires_payment_id;
-- ALTER TABLE public.orders ADD CONSTRAINT orders_paid_requires_payment_id
--   CHECK (payment_status <> 'paid' OR (payment_id IS NOT NULL AND trim(payment_id) <> ''));
