-- Update get_top_customers to include walk-ins
create or replace function get_top_customers(p_start date, p_end date)
returns table(
    profile_id uuid,
    full_name text,
    is_registered boolean,
    visit_count bigint,
    total_spent numeric
)
language sql
security definer
set search_path = public
as $$
    select 
        max(p.id::text)::uuid as profile_id,
        coalesce(p.full_name, ts.customer_name, 'Unknown') as full_name,
        (max(p.id::text) is not null) as is_registered,
        count(distinct o.id) as visit_count,
        coalesce(sum(o.total), 0) as total_spent
    from orders o
    left join profiles p on o.profile_id = p.id
    left join table_sessions ts on o.table_session_id = ts.id
    where o.status = 'PAID'
      and o.created_at >= p_start
      and o.created_at < (p_end + 1)
      -- Exclude completely unknown (no profile, no session name) 
      -- or keep them as "Unknown" bucket? 
      -- User said "all our walk-ins have names", but technically some might not.
      -- Let's filter out 'Unknown' to keep the list clean, or explicitly show them?
      -- Let's keep them, usually high revenue there.
    group by coalesce(p.full_name, ts.customer_name, 'Unknown')
    order by sum(o.total) desc
    limit 20;
$$;
