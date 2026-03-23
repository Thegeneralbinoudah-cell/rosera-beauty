-- بطاقات صالونات وأزرار واجهة لردود روزي (لإعادة العرض من السجل)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS rosey_salons jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rosey_actions jsonb DEFAULT NULL;

COMMENT ON COLUMN public.chat_messages.rosey_salons IS 'Top salon cards JSON array (assistant rows)';
COMMENT ON COLUMN public.chat_messages.rosey_actions IS 'UI action buttons JSON array (assistant rows)';
