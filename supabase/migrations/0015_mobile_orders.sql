-- Make table_session_id nullable to support mobile/online orders
ALTER TABLE orders ALTER COLUMN table_session_id DROP NOT NULL;

-- Add index for profile_id if not already covered (it was added in 0014 but good to verify)
CREATE INDEX IF NOT EXISTS idx_orders_profile ON orders(profile_id);
