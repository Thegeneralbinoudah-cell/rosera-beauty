-- Phase 4.2 hardening:
-- 1) Guard shipment status transitions
-- 2) Auto-fill expected_delivery_at from order items lead time when missing

CREATE OR REPLACE FUNCTION public.fn_guard_shipment_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') <> COALESCE(NEW.status, '') THEN
    IF OLD.status = 'pending' AND NEW.status NOT IN ('ready', 'failed', 'returned') THEN
      RAISE EXCEPTION 'Invalid shipment status transition: % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'ready' AND NEW.status NOT IN ('in_transit', 'failed', 'returned') THEN
      RAISE EXCEPTION 'Invalid shipment status transition: % -> %', OLD.status, NEW.status;
    ELSIF OLD.status = 'in_transit' AND NEW.status NOT IN ('delivered', 'failed', 'returned') THEN
      RAISE EXCEPTION 'Invalid shipment status transition: % -> %', OLD.status, NEW.status;
    ELSIF OLD.status IN ('delivered', 'failed', 'returned') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Terminal shipment status cannot be changed: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_shipment_status_transition ON public.shipments;
CREATE TRIGGER trg_guard_shipment_status_transition
BEFORE UPDATE OF status
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_shipment_status_transition();

CREATE OR REPLACE FUNCTION public.fn_set_expected_delivery_default()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_days INTEGER;
BEGIN
  IF NEW.expected_delivery_at IS NULL THEN
    SELECT COALESCE(MAX(pp.max_lead_time_days), 3)
    INTO v_max_days
    FROM public.order_items oi
    LEFT JOIN public.provider_products pp
      ON pp.product_id = oi.product_id
    WHERE oi.order_id = NEW.order_id;

    NEW.expected_delivery_at := now() + make_interval(days => GREATEST(COALESCE(v_max_days, 3), 1));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_expected_delivery_default ON public.shipments;
CREATE TRIGGER trg_set_expected_delivery_default
BEFORE INSERT
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_expected_delivery_default();
