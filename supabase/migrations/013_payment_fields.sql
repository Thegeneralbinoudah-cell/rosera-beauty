ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'free', 'failed', 'refunded'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'free', 'failed', 'refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
