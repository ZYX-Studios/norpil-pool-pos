-- 1. Get Top Customers
create or replace function get_top_customers(p_start date, p_end date)
returns table(
    profile_id uuid,
    full_name text,
    visit_count bigint,
    total_spent numeric
)
language sql
security definer
set search_path = public
as $$
    select 
        p.id as profile_id,
        p.full_name,
        count(distinct o.id) as visit_count,
        sum(o.total) as total_spent
    from orders o
    join profiles p on o.profile_id = p.id
    where o.status = 'PAID'
      and o.created_at >= p_start
      and o.created_at < (p_end + 1)
    group by p.id, p.full_name
    order by sum(o.total) desc
    limit 20;
$$;

-- 2. Get Wallet Liability (Total Unconsumed Credits)
create or replace function get_wallet_liability()
returns numeric
language sql
security definer
set search_path = public
as $$
    select coalesce(sum(balance), 0)
    from wallets;
$$;
