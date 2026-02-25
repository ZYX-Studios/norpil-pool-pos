-- AR Tabs Fix: Auto-create customers from profiles
-- This migration modifies the charge_to_tab function to automatically create a customer record
-- if a profile exists with the given ID but no customer record exists.
-- This bridges the gap between the UI (which selects Profiles) and the AR system (which uses Customers).

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
    v_profile_name TEXT;
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
        -- Try to find in profiles to auto-create
        SELECT full_name INTO v_profile_name FROM profiles WHERE id = p_customer_id;
        
        IF FOUND THEN
            -- Auto-create customer record
            -- Default credit limit 0 means unlimited in the check logic below
            INSERT INTO customers (id, name, status, credit_limit_cents)
            VALUES (p_customer_id, COALESCE(v_profile_name, 'Unknown Profile'), 'active', 0)
            RETURNING status, credit_limit_cents INTO v_customer_status, v_credit_limit_cents;
        ELSE
            RAISE EXCEPTION 'Customer not found';
        END IF;
    END IF;
    
    -- Check if customer is active
    IF v_customer_status != 'active' THEN
        RAISE EXCEPTION 'Customer is not active';
    END IF;
    
    -- Get current balance (now safe due to lock)
    v_current_balance := get_customer_balance(p_customer_id);
    
    -- Check if charge would exceed credit limit
    -- Note: 0 means unlimited
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

-- Also update make_payment_to_tab for consistency
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
    v_profile_name TEXT;
BEGIN
    -- Ensure amount is positive
    IF p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
    END IF;

    -- Validate customer exists or auto-create
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
        -- Try to find in profiles
        SELECT full_name INTO v_profile_name FROM profiles WHERE id = p_customer_id;
        
        IF FOUND THEN
            -- Auto-create customer record
            INSERT INTO customers (id, name, status, credit_limit_cents)
            VALUES (p_customer_id, COALESCE(v_profile_name, 'Unknown Profile'), 'active', 0);
        ELSE
            RAISE EXCEPTION 'Customer not found';
        END IF;
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


