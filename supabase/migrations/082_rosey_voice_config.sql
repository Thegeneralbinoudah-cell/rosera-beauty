-- Single-row ElevenLabs voice_id for Rosie/Rosy TTS (client reads with DB-first priority).
CREATE TABLE IF NOT EXISTS public.rosey_voice_config (
  id smallint PRIMARY KEY DEFAULT 1,
  voice_id text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rosey_voice_config_single_row CHECK (id = 1)
);

COMMENT ON TABLE public.rosey_voice_config IS 'ElevenLabs voice_id for in-app TTS. Non-empty voice_id overrides VITE_ELEVENLABS_VOICE_ID.';

INSERT INTO public.rosey_voice_config (id, voice_id) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rosey_voice_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rosey_voice_config_select_anon"
  ON public.rosey_voice_config FOR SELECT TO anon USING (true);

CREATE POLICY "rosey_voice_config_select_authenticated"
  ON public.rosey_voice_config FOR SELECT TO authenticated USING (true);
