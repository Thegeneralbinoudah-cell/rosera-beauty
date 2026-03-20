-- Align OTP storage column with edge function spec (`code` instead of `otp`).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'otp_codes' AND column_name = 'otp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'otp_codes' AND column_name = 'code'
  ) THEN
    ALTER TABLE public.otp_codes RENAME COLUMN otp TO code;
  END IF;
END $$;
