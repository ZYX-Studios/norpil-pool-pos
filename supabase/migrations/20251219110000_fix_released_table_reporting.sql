-- Migration: Add location_name to table_sessions and update reporting
-- Purpose: Persist the table name (or "Walk-in") in the session record so that
-- releasing a table (which nulls pool_table_id) doesn't lose the reporting context.

-- 1. Add column
alter table table_sessions 
add column if not exists location_name text;

-- 2. Backfill existing data
-- For active tables (pool_table_id is not null)
update table_sessions 
set location_name = (select name from pool_tables where id = table_sessions.pool_table_id) 
where pool_table_id is not null 
  and location_name is null;

-- For walk-ins (pool_table_id is null, but we can't easily distinguish old released tables from true walk-ins)
-- We'll leave them null or set to 'Walk-in' depending on preference. 
-- The RPC below handles NULLs by falling back to 'Walk-in', so strictly speaking we don't *need* to backfill walk-ins,
-- but consistent data is nicer. Let's set distinct Walk-ins if we can, but simpler is safer:
-- We only backfill what we KNOW (active tables).

-- 3. Update revenue_by_table RPC to use location_name
create or replace function revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
    select 
        -- Prefer the persisted location_name. Fallback to join if missing (for old data/race conditions).
        -- If both are missing, it's a Walk-in.
        coalesce(ts.location_name, pt.name, 'Walk-in') as table_name,
        coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2) as revenue
    from payments pay
    join orders o on o.id = pay.order_id
    left join table_sessions ts on ts.id = o.table_session_id
    left join pool_tables pt on pt.id = ts.pool_table_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and pay.paid_at >= p_start
      and pay.paid_at < (p_end + 1)
    group by 1
    order by revenue desc;
$$;
