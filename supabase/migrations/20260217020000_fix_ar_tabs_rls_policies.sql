-- Fix RLS policies for ar_ledger_entries and customers
-- The original policy used staff.id instead of staff.user_id
-- auth.uid() returns the auth.users.id, which matches staff.user_id, NOT staff.id

-- Fix customers RLS policies
DROP POLICY IF EXISTS "Staff can view customers" ON customers;
DROP POLICY IF EXISTS "Staff can insert customers" ON customers;
DROP POLICY IF EXISTS "Staff can update customers" ON customers;

CREATE POLICY "Staff can view customers" ON customers
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM staff));

CREATE POLICY "Staff can insert customers" ON customers
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM staff));

CREATE POLICY "Staff can update customers" ON customers
    FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM staff));

-- Fix ar_ledger_entries RLS policies
DROP POLICY IF EXISTS "Staff can view ar_ledger_entries" ON ar_ledger_entries;
DROP POLICY IF EXISTS "Staff can insert ar_ledger_entries" ON ar_ledger_entries;
DROP POLICY IF EXISTS "Staff can update ar_ledger_entries" ON ar_ledger_entries;

CREATE POLICY "Staff can view ar_ledger_entries" ON ar_ledger_entries
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM staff));

CREATE POLICY "Staff can insert ar_ledger_entries" ON ar_ledger_entries
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM staff));

CREATE POLICY "Staff can update ar_ledger_entries" ON ar_ledger_entries
    FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM staff));
