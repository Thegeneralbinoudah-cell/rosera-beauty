-- بطاقات منتجات المتجر في ردود روزي (لإعادة العرض من السجل)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS rosey_products jsonb DEFAULT NULL;

COMMENT ON COLUMN public.chat_messages.rosey_products IS 'Store product cards JSON array (assistant rows)';
