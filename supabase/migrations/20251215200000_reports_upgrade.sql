-- 1. Revenue by Hour RPC
-- Returns revenue and order count for each hour of the day (0-23)
create or replace function revenue_by_hour(p_start date, p_end date)
returns table(hour int, revenue numeric, order_count bigint)
language sql
security definer
set search_path = public
as $$
    with hours as (
        select generate_series(0, 23) as hour
    ),
    hourly_data as (
        select 
            extract(hour from pay.paid_at)::int as hour,
            sum(pay.amount) as revenue,
            count(distinct pay.order_id) as order_count
        from payments pay
        join orders o on o.id = pay.order_id
        where o.status = 'PAID'
          and pay.paid_at >= p_start
          and pay.paid_at < (p_end + 1)
        group by 1
    )
    select 
        h.hour,
        coalesce(hd.revenue, 0)::numeric(10,2) as revenue,
        coalesce(hd.order_count, 0)::bigint as order_count
    from hours h
    left join hourly_data hd on hd.hour = h.hour
    order by h.hour;
$$;

-- 2. Expense Delete Policy
-- Allow authenticated users (staff/admins) to delete expenses.
do $$
begin
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses' and policyname = 'expenses_delete') then
        create policy expenses_delete on expenses for delete to authenticated using (true);
    end if;
end $$;
