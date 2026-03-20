-- Phase 4.1: Automation for SLA + order events

CREATE OR REPLACE FUNCTION public.fn_set_shipment_sla_breached()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sla_breached :=
    NEW.expected_delivery_at IS NOT NULL
    AND NEW.status <> 'delivered'
    AND now() > NEW.expected_delivery_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_shipment_sla_breached ON public.shipments;
CREATE TRIGGER trg_set_shipment_sla_breached
BEFORE INSERT OR UPDATE OF status, expected_delivery_at
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_shipment_sla_breached();

CREATE OR REPLACE FUNCTION public.fn_log_shipment_events()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_msg TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_msg := format(
      'تم إنشاء الشحنة (%s) برقم تتبع %s',
      NEW.status,
      COALESCE(NEW.tracking_number, '—')
    );
    INSERT INTO public.order_events(order_id, event_type, event_data, created_by)
    VALUES (NEW.order_id, 'shipment_created', jsonb_build_object('message', v_msg), auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status, '') <> COALESCE(NEW.status, '') THEN
      v_msg := format('تغيّرت حالة الشحنة من %s إلى %s', OLD.status, NEW.status);
      INSERT INTO public.order_events(order_id, event_type, event_data, created_by)
      VALUES (NEW.order_id, 'shipment_status_changed', jsonb_build_object('message', v_msg), auth.uid());
    END IF;

    IF COALESCE(OLD.sla_breached, false) = false AND COALESCE(NEW.sla_breached, false) = true THEN
      INSERT INTO public.order_events(order_id, event_type, event_data, created_by)
      VALUES (
        NEW.order_id,
        'sla_breached',
        jsonb_build_object('message', 'تم تجاوز SLA للشحنة'),
        auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_shipment_events ON public.shipments;
CREATE TRIGGER trg_log_shipment_events
AFTER INSERT OR UPDATE OF status, sla_breached
ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_shipment_events();
