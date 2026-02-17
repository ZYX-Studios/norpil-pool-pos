-- Add balance_cents (AR tab balance) to search_customers RPC
-- Per red-team report, search_customers was missing AR tab balance
-- This migration adds balance_cents from customer_balances view

DROP FUNCTION IF EXISTS search_customers(text);

CREATE OR REPLACE FUNCTION search_customers(p_query text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text,
  avatar_url text,
  email varchar,
  membership_number text,
  wallet_id uuid,
  balance numeric,
  balance_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure caller is staff
  IF NOT EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Staff only';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.phone_number,
    p.avatar_url,
    u.email::varchar,
    p.membership_number,
    w.id as wallet_id,
    COALESCE(w.balance, 0) as balance,
    COALESCE(cb.balance_cents, 0) as balance_cents
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN wallets w ON w.profile_id = p.id
  LEFT JOIN customer_balances cb ON cb.id = p.id
  WHERE 
    p.full_name ILIKE '%' || p_query || '%'
    OR p.phone_number ILIKE '%' || p_query || '%'
    OR u.email ILIKE '%' || p_query || '%'
    OR p.membership_number ILIKE '%' || p_query || '%'
  LIMIT 10;
END;
$$;
