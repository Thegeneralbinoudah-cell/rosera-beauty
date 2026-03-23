-- Salon owners: read analytics events tied to their business + update business row via salon_owners

DROP POLICY IF EXISTS "user_events_select_salon_owner_business" ON public.user_events;

CREATE POLICY "user_events_select_salon_owner_business"
  ON public.user_events FOR SELECT
  USING (
    entity_type = 'business'
    AND (
      EXISTS (
        SELECT 1 FROM public.salon_owners so
        WHERE so.salon_id = user_events.entity_id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = user_events.entity_id AND b.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "p_businesses_update_salon_owners" ON public.businesses;

CREATE POLICY "p_businesses_update_salon_owners"
  ON public.businesses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.salon_owners so
      WHERE so.salon_id = businesses.id AND so.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.salon_owners so
      WHERE so.salon_id = businesses.id AND so.user_id = auth.uid()
    )
  );
