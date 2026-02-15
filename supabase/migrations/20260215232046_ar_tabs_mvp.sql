-- AR Tabs MVP Migration
-- Creates customers and ar_ledger_entries tables for running tabs/accounts receivable

-- Add TAB to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'TAB';

-- Create enum for customer status
CREATE TYPE customer_status AS ENUM ('active', 'inactive');

-- Create enum for ledger entry type
CREATE TYPE ledger_entry_type AS ENUM ('CHARGE', 'PAYMENT', 'ADJUSTMENT');

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status customer_status NOT NULL DEFAULT 'active',
    credit_limit_cents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ar_ledger_entries table
CREATE TABLE IF NOT EXISTS ar_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT, -- Changed from CASCADE to RESTRICT for safety
    amount_cents BIGINT NOT NULL,
    type ledger_entry_type NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    pos_session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure amount_cents is non-zero
    CONSTRAINT amount_cents_non_zero CHECK (amount_cents != 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_customer_id ON ar_ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_created_at ON ar_ledger_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_staff_id ON ar_ledger_entries(staff_id);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_pos_session_id ON ar_ledger_entries(pos_session_id);
CREATE INDEX IF NOT EXISTS idx_ar_ledger_entries_idempotency_key ON ar_ledger_entries(idempotency_key);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers table
-- Staff can view all customers
CREATE POLICY "Staff can view customers" ON customers
    FOR SELECT USING (auth.uid() IN (SELECT id FROM staff));

-- Staff can insert customers
CREATE POLICY "Staff can insert customers" ON customers
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM staff));

-- Staff can update customers
CREATE POLICY "Staff can update customers" ON customers
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM staff));

-- RLS Policies for ar_ledger_entries table
-- Staff can view all ledger entries
CREATE POLICY "Staff can view ar_ledger_entries" ON ar_ledger_entries
    FOR SELECT USING (auth.uid() IN (SELECT id FROM staff));

-- Staff can insert ledger entries (Restrict to own ID or via function?)
-- Allowing INSERT if staff_id matches auth.uid()
CREATE POLICY "Staff can insert ar_ledger_entries" ON ar_ledger_entries
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT id FROM staff) AND
        staff_id = auth.uid()
    );

-- Staff can update ledger entries (limited use case, e.g., corrections)
CREATE POLICY "Staff can update ar_ledger_entries" ON ar_ledger_entries
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM staff));

-- Create a function to get customer balance
CREATE OR REPLACE FUNCTION get_customer_balance(customer_uuid UUID)
RETURNS BIGINT AS $$
DECLARE
    total_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN type = 'CHARGE' THEN amount_cents
            WHEN type = 'PAYMENT' THEN -amount_cents
            WHEN type = 'ADJUSTMENT' THEN amount_cents
            ELSE 0
        END
    ), 0) INTO total_balance
    FROM ar_ledger_entries
    WHERE customer_id = customer_uuid;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to charge to tab with validation
CREATE OR REPLACE FUNCTION charge_to_tab(
    p_customer_id UUID,
    p_amount_cents BIGINT,
    p_staff_id UUID,
    p_idempotency_key TEXT,
    p_pos_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_customer_status customer_status;
    v_credit_limit_cents BIGINT;
    v_current_balance BIGINT;
    v_new_entry_id UUID;
BEGIN
    -- Ensure amount is positive
    IF p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'Charge amount must be positive';
    END IF;

    -- Lock the customer record to prevent race conditions
    SELECT status, credit_limit_cents INTO v_customer_status, v_credit_limit_cents
    FROM customers 
    WHERE id = p_customer_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;
    
    -- Check if customer is active
    IF v_customer_status != 'active' THEN
        RAISE EXCEPTION 'Customer is not active';
    END IF;
    
    -- Get current balance (now safe due to lock)
    v_current_balance := get_customer_balance(p_customer_id);
    
    -- Check if charge would exceed credit limit
    IF v_credit_limit_cents > 0 AND (v_current_balance + p_amount_cents) > v_credit_limit_cents THEN
        RAISE EXCEPTION 'Charge would exceed credit limit. Current balance: %, Credit limit: %, Charge amount: %', 
            v_current_balance, v_credit_limit_cents, p_amount_cents;
    END IF;
    
    -- Insert the ledger entry
    INSERT INTO ar_ledger_entries (
        customer_id,
        amount_cents,
        type,
        idempotency_key,
        pos_session_id,
        staff_id
    ) VALUES (
        p_customer_id,
        p_amount_cents,
        'CHARGE',
        p_idempotency_key,
        p_pos_session_id,
        p_staff_id
    ) RETURNING id INTO v_new_entry_id;
    
    RETURN v_new_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to make a payment
CREATE OR REPLACE FUNCTION make_payment_to_tab(
    p_customer_id UUID,
    p_amount_cents BIGINT,
    p_staff_id UUID,
    p_idempotency_key TEXT,
    p_pos_session_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_entry_id UUID;
BEGIN
    -- Ensure amount is positive
    IF p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    -- Validate customer exists
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;
    
    -- Insert the payment ledger entry (positive amount, type determines sign)
    INSERT INTO ar_ledger_entries (
        customer_id,
        amount_cents,
        type,
        idempotency_key,
        pos_session_id,
        staff_id
    ) VALUES (
        p_customer_id,
        p_amount_cents,
        'PAYMENT',
        p_idempotency_key,
        p_pos_session_id,
        p_staff_id
    ) RETURNING id INTO v_new_entry_id;
    
    RETURN v_new_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for customer balances
CREATE OR REPLACE VIEW customer_balances AS
SELECT 
    c.id,
    c.name,
    c.status,
    c.credit_limit_cents,
    c.created_at,
    COALESCE(SUM(
        CASE 
            WHEN ale.type = 'CHARGE' THEN ale.amount_cents
            WHEN ale.type = 'PAYMENT' THEN -ale.amount_cents
            WHEN ale.type = 'ADJUSTMENT' THEN ale.amount_cents
            ELSE 0
        END
    ), 0) AS balance_cents,
    COUNT(ale.id) AS transaction_count,
    MAX(ale.created_at) AS last_transaction_date
FROM customers c
LEFT JOIN ar_ledger_entries ale ON c.id = ale.customer_id
GROUP BY c.id, c.name, c.status, c.credit_limit_cents, c.created_at;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_customer_balance TO authenticated;
GRANT EXECUTE ON FUNCTION charge_to_tab TO authenticated;
GRANT EXECUTE ON FUNCTION make_payment_to_tab TO authenticated;
GRANT SELECT ON customer_balances TO authenticated;
