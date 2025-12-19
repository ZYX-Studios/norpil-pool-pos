-- Migration: Fix timezone issues in reporting (Enforce Asia/Manila)
-- Purpose: Ensure reports for "Today" (e.g. Dec 19) capture 12:00 AM - 11:59 PM Manila Time,
-- instead of 12:00 AM - 11:59 PM UTC (which is 8am - 8am Manila).
-- This fixes the issue where late night/early morning sales (12am-3am) fall into the "Previous Day" in UTC.

-- 1. total_revenue
drop function if exists total_revenue(date, date);
create or replace function total_revenue(p_start date, p_end date)
returns numeric
language sql
security definer
set search_path = public
as $$
  -- Fallback logic matches Client Side: 
  -- If o.total is 0 or null, we assume it's a glitch and trust the payment amount (via NULLIF)
  select coalesce(sum(least(amount, nullif(o.total, 0))), 0)
  from payments p
  join orders o on o.id = p.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and (p.paid_at at time zone 'Asia/Manila')::date >= p_start
    and (p.paid_at at time zone 'Asia/Manila')::date <= p_end;
$$;

-- 2. revenue_by_category
drop function if exists revenue_by_category(date, date);
create or replace function revenue_by_category(p_start date, p_end date)
returns table(category text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select 
    case 
      when p.name ilike '%table%' then 'TABLE_TIME' 
      when p.category is null then 'OTHER'
      else p.category 
    end as category,
    sum(oi.line_total) as revenue
  from order_items oi
  join products p on p.id = oi.product_id
  join orders o on o.id = oi.order_id
  join payments pay on pay.order_id = o.id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and (pay.paid_at at time zone 'Asia/Manila')::date >= p_start
    and (pay.paid_at at time zone 'Asia/Manila')::date <= p_end
  group by 1
  order by revenue desc;
$$;

-- 3. revenue_by_method
drop function if exists revenue_by_method(date, date);
create or replace function revenue_by_method(p_start date, p_end date)
returns table(method text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select 
    -- Normalize Method Name: Title Case and Trim to merge duplicates
    initcap(trim(p.method::text)) as method,
    sum(coalesce(least(amount, nullif(o.total, 0)), 0)) as revenue
  from payments p
  join orders o on o.id = p.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and (p.paid_at at time zone 'Asia/Manila')::date >= p_start
    and (p.paid_at at time zone 'Asia/Manila')::date <= p_end
  group by 1
  order by revenue desc;
$$;

-- 4. revenue_by_shift
drop function if exists revenue_by_shift(date, date);
create or replace function revenue_by_shift(p_start date, p_end date)
returns table(shift_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    case
      -- Night Shift: 10 PM to 4 AM (Manila Time)
      when extract(hour from (pay.paid_at at time zone 'Asia/Manila')) >= 22 
        or extract(hour from (pay.paid_at at time zone 'Asia/Manila')) < 4 
      then 'Night Shift'
      else 'Day Shift'
    end as shift_name,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and (pay.paid_at at time zone 'Asia/Manila')::date >= p_start
    and (pay.paid_at at time zone 'Asia/Manila')::date <= p_end
  group by 1
  order by revenue desc;
$$;

-- 5. daily_revenue
drop function if exists daily_revenue(date, date);
create or replace function daily_revenue(p_start date, p_end date)
returns table(day text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(p_start, p_end, '1 day'::interval)::date as d
  )
  select 
    to_char(days.d, 'YYYY-MM-DD'),
    coalesce(sum(least(pay.amount, nullif(o.total, 0))), 0)
  from days
  left join payments pay on (pay.paid_at at time zone 'Asia/Manila')::date = days.d
  left join orders o on o.id = pay.order_id 
       and o.status in ('PAID', 'SERVED') 
       and o.status != 'VOIDED'
  group by 1
  order by 1;
$$;

-- 6. revenue_by_table (Updated to match previous fix + timezone)
drop function if exists revenue_by_table(date, date);
create or replace function revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
    select 
        coalesce(ts.location_name, pt.name, 'Walk-in') as table_name,
        coalesce(sum(least(pay.amount, nullif(o.total, 0))), 0)::numeric(10,2) as revenue
    from payments pay
    join orders o on o.id = pay.order_id
    left join table_sessions ts on ts.id = o.table_session_id
    left join pool_tables pt on pt.id = ts.pool_table_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and (pay.paid_at at time zone 'Asia/Manila')::date >= p_start
      and (pay.paid_at at time zone 'Asia/Manila')::date <= p_end
    group by 1
    order by revenue desc;
$$;

-- 7. get_expenses
drop function if exists get_expenses(date, date);
create or replace function get_expenses(p_start date, p_end date)
returns table(
  id uuid,
  category text,
  amount numeric,
  description text,
  expense_date date,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, category::text, amount, note as description, expense_date, created_at
  from expenses
  where expense_date >= p_start 
    and expense_date <= p_end;
$$;

-- 8. monthly_financial_summary
-- This is a composite function, usually re-uses logic or does its own agg.
-- Let's update it to respect timezone for consistency.
drop function if exists monthly_financial_summary(date, date);
create or replace function monthly_financial_summary(p_start date, p_end date)
returns table(
    month_start date,
    revenue numeric,
    expenses numeric,
    net numeric,
    margin numeric
)
language sql
security definer
set search_path = public
as $$
with months as (
    -- Generate series of months for the range
    select generate_series(
        date_trunc('month', p_start),
        date_trunc('month', p_end),
        '1 month'::interval
    )::date as m
),
monthly_sales as (
    select 
        date_trunc('month', p.paid_at at time zone 'Asia/Manila')::date as m,
        coalesce(sum(least(amount, nullif(o.total, 0))), 0) as revenue
    from payments p
    join orders o on o.id = p.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and (p.paid_at at time zone 'Asia/Manila')::date >= p_start
      and (p.paid_at at time zone 'Asia/Manila')::date <= p_end
    group by 1
),
monthly_expenses as (
    select 
        date_trunc('month', expense_date)::date as m,
        coalesce(sum(amount), 0) as amount
    from expenses
    where expense_date >= p_start and expense_date <= p_end
    group by 1
)
select 
    months.m as month_start,
    coalesce(s.revenue, 0) as revenue,
    coalesce(e.amount, 0) as expenses,
    coalesce(s.revenue, 0) - coalesce(e.amount, 0) as net,
    case 
        when coalesce(s.revenue, 0) > 0 then 
            ((coalesce(s.revenue, 0) - coalesce(e.amount, 0)) / coalesce(s.revenue, 0)) * 100
        else 0
    end as margin
from months
left join monthly_sales s on s.m = months.m
left join monthly_expenses e on e.m = months.m
order by months.m desc;
$$;

-- 9. revenue_by_hour (Bonus fix: ensure hour bucketing is in Manila time)
drop function if exists revenue_by_hour(date, date);
create or replace function revenue_by_hour(p_start date, p_end date)
returns table(hour int, revenue numeric)
language sql
security definer
set search_path = public
as $$
  with hours as (
    select generate_series(0, 23) as h
  ),
  hourly_sales as (
      select 
        extract(hour from (p.paid_at at time zone 'Asia/Manila'))::int as h,
        sum(least(p.amount, nullif(o.total, 0))) as revenue
      from payments p
      join orders o on o.id = p.order_id
      where o.status in ('PAID', 'SERVED')
        and o.status != 'VOIDED'
        and (p.paid_at at time zone 'Asia/Manila')::date >= p_start
        and (p.paid_at at time zone 'Asia/Manila')::date <= p_end
      group by 1
  )
  select 
    hours.h,
    coalesce(sales.revenue, 0)
  from hours
  left join hourly_sales sales on sales.h = hours.h
  order by 1;
$$; -- Note: this aggregates across all days in range for that hour. Correct for "Hourly Sales" chart.
