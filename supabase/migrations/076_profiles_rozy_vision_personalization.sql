-- Rosy Vision: persist undertone + preferred styles + light history for personalization (no images).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rozy_vision_personalization jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.rozy_vision_personalization IS
  'Client-owned JSON: undertone, face_shape, preferred_styles[], history[] — see rozyVisionPersonalization.ts';
