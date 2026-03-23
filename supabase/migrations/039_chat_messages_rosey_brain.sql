-- Rosy Brain: persist intent, entities, and structured booking hints on assistant rows.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS rosey_intent text,
  ADD COLUMN IF NOT EXISTS rosey_entities jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rosey_action jsonb;

COMMENT ON COLUMN public.chat_messages.rosey_intent IS 'Last classified intent (assistant messages)';
COMMENT ON COLUMN public.chat_messages.rosey_entities IS 'Extracted entities JSON (assistant messages)';
COMMENT ON COLUMN public.chat_messages.rosey_action IS 'Structured follow-up e.g. {action:booking, salon_id, ...}';
