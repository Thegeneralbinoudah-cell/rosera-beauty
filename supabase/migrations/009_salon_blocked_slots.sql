CREATE TABLE IF NOT EXISTS public.salon_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.salon_blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_blocked_select_owner" ON public.salon_blocked_slots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.salon_owners so WHERE so.user_id = auth.uid() AND so.salon_id = salon_blocked_slots.business_id)
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = salon_blocked_slots.business_id AND b.owner_id = auth.uid())
);

CREATE POLICY "salon_blocked_insert_owner" ON public.salon_blocked_slots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.salon_owners so WHERE so.user_id = auth.uid() AND so.salon_id = business_id)
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
);

CREATE POLICY "salon_blocked_update_owner" ON public.salon_blocked_slots FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.salon_owners so WHERE so.user_id = auth.uid() AND so.salon_id = salon_blocked_slots.business_id)
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = salon_blocked_slots.business_id AND b.owner_id = auth.uid())
);

CREATE POLICY "salon_blocked_delete_owner" ON public.salon_blocked_slots FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.salon_owners so WHERE so.user_id = auth.uid() AND so.salon_id = salon_blocked_slots.business_id)
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = salon_blocked_slots.business_id AND b.owner_id = auth.uid())
);
