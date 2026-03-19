CREATE POLICY "bookings_select_by_salon_owner" ON public.bookings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    WHERE so.user_id = auth.uid() AND so.salon_id = bookings.business_id
  )
);

CREATE POLICY "bookings_update_by_salon_owner" ON public.bookings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    WHERE so.user_id = auth.uid() AND so.salon_id = bookings.business_id
  )
);

CREATE POLICY "services_mutate_by_salon_owner" ON public.services FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    JOIN public.businesses b ON b.id = so.salon_id
    WHERE so.user_id = auth.uid() AND services.business_id = b.id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.salon_owners so
    WHERE so.user_id = auth.uid() AND so.salon_id = services.business_id
  )
);
