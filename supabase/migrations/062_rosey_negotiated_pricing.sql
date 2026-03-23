-- Rosy-assisted price flexibility: salon rules + optional negotiated discount on bookings

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS rosy_pricing_flexible BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rosy_discount_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rosy_max_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 10
    CHECK (rosy_max_discount_percent >= 0 AND rosy_max_discount_percent <= 15);

COMMENT ON COLUMN public.businesses.rosy_pricing_flexible IS 'If true, Rosy may suggest cheaper services or nearby lower-priced salons.';
COMMENT ON COLUMN public.businesses.rosy_discount_allowed IS 'If true, Rosy may offer an extra % off within rosy_max_discount_percent (5–15% cap).';
COMMENT ON COLUMN public.businesses.rosy_max_discount_percent IS 'Upper bound for Rosy-quoted discount; must be <= 15.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rosey_negotiated_discount_percent NUMERIC(5, 2) NULL
    CHECK (rosey_negotiated_discount_percent IS NULL OR (rosey_negotiated_discount_percent >= 0 AND rosey_negotiated_discount_percent <= 15));

COMMENT ON COLUMN public.bookings.rosey_negotiated_discount_percent IS 'Extra Rosy-negotiated % applied on top of cart after salon offer; null if none.';
