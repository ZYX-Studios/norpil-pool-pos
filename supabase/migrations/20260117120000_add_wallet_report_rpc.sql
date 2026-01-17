CREATE OR REPLACE FUNCTION get_wallet_liabilities_report()
RETURNS TABLE (
    wallet_id uuid,
    profile_id uuid,
    balance numeric,
    full_name text,
    phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        w.id as wallet_id,
        w.profile_id,
        w.balance,
        p.full_name,
        p.phone
    FROM wallets w
    LEFT JOIN profiles p ON w.profile_id = p.id
    WHERE w.balance > 0
    ORDER BY w.balance DESC;
$$;
