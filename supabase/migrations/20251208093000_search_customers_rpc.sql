-- Secure RPC to search customers including email from auth.users
-- Only accessible by staff
create or replace function search_customers(p_query text)
returns table (
  id uuid,
  full_name text,
  phone_number text,
  avatar_url text,
  email varchar,
  wallet_id uuid,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure caller is staff
  if not exists (select 1 from staff where user_id = auth.uid()) then
    raise exception 'Access denied: Staff only';
  end if;

  return query
  select 
    p.id,
    p.full_name,
    p.phone_number,
    p.avatar_url,
    u.email::varchar,
    w.id as wallet_id,
    coalesce(w.balance, 0) as balance
  from profiles p
  join auth.users u on u.id = p.id
  left join wallets w on w.profile_id = p.id
  where 
    p.full_name ilike '%' || p_query || '%'
    or p.phone_number ilike '%' || p_query || '%'
    or u.email ilike '%' || p_query || '%'
  limit 10;
end;
$$;
