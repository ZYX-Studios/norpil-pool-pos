-- Add phone column to customers table for guest identification
-- Phone should be unique to prevent duplicate guest entries

-- Add phone column (nullable, existing customers will have NULL)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create unique index on phone (only non-null values)
-- This ensures no two customers have the same phone number
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone) WHERE phone IS NOT NULL;

-- Update existing customers with phone from profiles if possible
-- (Optional: we could later backfill phone numbers from profiles.phone)
-- For now, just keep NULL.