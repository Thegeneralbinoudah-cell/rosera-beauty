-- Customer app: show salon team on public salon detail; optional bilingual service names.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS name_en TEXT;

DROP POLICY IF EXISTS "salon_team_select_public" ON public.salon_team;
CREATE POLICY "salon_team_select_public" ON public.salon_team FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = salon_team.salon_id
      AND COALESCE(b.is_active, true) = true
      AND COALESCE(b.is_demo, false) = false
  )
);
