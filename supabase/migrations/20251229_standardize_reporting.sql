-- 0. Cleanup Old Functions (to allow return type changes)
drop function if exists total_revenue(date, date);
drop function if exists revenue_by_category(date, date);
drop function if exists revenue_by_method(date, date);
drop function if exists revenue_by_shift(date, date);
drop function if exists daily_revenue(date, date);
drop function if exists revenue_by_hour(date, date);
drop function if exists revenue_by_table(date, date);
drop function if exists monthly_financial_summary(date, date);
drop function if exists get_top_customers(date, date);

-- 1. Helper Function: get_business_date
-- Converts a timestamp to its "Operational Business Date".
-- Business Day starts at 10:00 AM Manila Time.
-- Logic: Subtract 10 hours from Manila Time.
-- Ex: Dec 29 09:00 -> -10h -> Dec 28 23:00 -> Date: Dec 28
-- Ex: Dec 29 10:00 -> -10h -> Dec 29 00:00 -> Date: Dec 29
-- Ex: Dec 30 02:00 -> -10h -> Dec 29 16:00 -> Date: Dec 29
create or replace function get_business_date(ts timestamptz)
returns date
language sql
immutable
as $$
  select ((ts at time zone 'Asia/Manila') - interval '10 hours')::date;
$$;

-- 2. Update total_revenue
create or replace function total_revenue(p_start date, p_end date)
returns numeric
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(least(pay.amount, nullif(o.total, 0))), 0)
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end;
$$;

-- 3. Update revenue_by_category
create or replace function revenue_by_category(p_start date, p_end date)
returns table(category text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    -- Simplified category mapping
    case 
      when o.table_session_id is not null and p.name = 'Table Time' then 'TABLE_TIME'
      when p.category = 'DRINK' then 'DRINK'
      when p.category = 'FOOD' then 'FOOD'
      else 'OTHER'
    end as category,
    sum(i.line_total) as revenue
  from order_items i
  join orders o on o.id = i.order_id
  join payments pay on pay.order_id = o.id
  left join products p on p.id = i.product_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by revenue desc;
$$;

-- 4. Update revenue_by_method
create or replace function revenue_by_method(p_start date, p_end date)
returns table(method text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    pay.method,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by revenue desc;
$$;

-- 5. Update revenue_by_shift
-- Shift Definitions relative to Business Day:
-- Day Shift: 10:00 AM - 6:00 PM (Manila Time)
-- Night Shift: 6:00 PM - 10:00 AM Next Day (Manila Time)
-- Since we filter by Business Date, we just need to check the Hour of the transaction.
-- If (Manila Hour >= 10 AND Manila Hour < 18) -> Day Shift.
-- Else -> Night Shift.
create or replace function revenue_by_shift(p_start date, p_end date)
returns table(shift_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    case
      when (pay.paid_at at time zone 'Asia/Manila')::time >= '10:00:00'::time 
       and (pay.paid_at at time zone 'Asia/Manila')::time < '18:00:00'::time
      then 'Day Shift'
      else 'Night Shift'
    end as shift_name,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by revenue desc;
$$;

-- 6. Update daily_revenue
create or replace function daily_revenue(p_start date, p_end date)
returns table(date text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    to_char(get_business_date(pay.paid_at), 'YYYY-MM-DD') as date,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by date asc;
$$;

-- 7. Update revenue_by_hour
-- We group by hour 0-23. 
-- Note: 'Hour' on the chart usually implies the hour of the Business Day? 
-- Or just standard clock hour?
-- Standard clock hour is easier for charts. We just filter by Business Date range.
create or replace function revenue_by_hour(p_start date, p_end date)
returns table(hour int, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    extract(hour from (pay.paid_at at time zone 'Asia/Manila'))::int as hour,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by 1;
$$;

-- 8. Update revenue_by_table
create or replace function revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(pt.name, ts.location_name, 'Walk-in') as table_name,
    sum(least(pay.amount, nullif(o.total, 0))) as revenue
  from payments pay
  join orders o on o.id = pay.order_id
  join table_sessions ts on ts.id = o.table_session_id
  left join pool_tables pt on pt.id = ts.pool_table_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  group by 1
  order by revenue desc;
$$;

-- 9. Update monthly_financial_summary
-- This aggregates by MONTH of the Business Date
create or replace function monthly_financial_summary(p_start date, p_end date)
returns table(
  month text,
  total_revenue numeric,
  total_expenses numeric,
  net_profit numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with sales as (
    select
      to_char(get_business_date(pay.paid_at), 'YYYY-MM') as m,
      sum(least(pay.amount, nullif(o.total, 0))) as rev
    from payments pay
    join orders o on o.id = pay.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and get_business_date(pay.paid_at) >= p_start
      and get_business_date(pay.paid_at) <= p_end
    group by 1
  ),
  costs as (
    select
      to_char(expense_date, 'YYYY-MM') as m,
      sum(amount) as exp
    from expenses
    where expense_date >= p_start
      and expense_date <= p_end
    group by 1
  )
  select
    coalesce(s.m, c.m) as month,
    coalesce(s.rev, 0) as total_revenue,
    coalesce(c.exp, 0) as total_expenses,
    (coalesce(s.rev, 0) - coalesce(c.exp, 0)) as net_profit
  from sales s
  full outer join costs c on s.m = c.m
  order by 1 desc;
end;
$$;

-- 10. Update get_top_customers
create or replace function get_top_customers(p_start date, p_end date)
returns table(customer_name text, total_spent numeric, visit_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(p.full_name, ts.customer_name, 'Walk-in') as customer_name,
    sum(least(pay.amount, nullif(o.total, 0))) as total_spent,
    count(distinct ts.id) as visit_count
  from payments pay
  join orders o on o.id = pay.order_id
  join table_sessions ts on ts.id = o.table_session_id
  left join profiles p on p.id = ts.opened_by
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and get_business_date(pay.paid_at) >= p_start
    and get_business_date(pay.paid_at) <= p_end
  -- Exclude generic walk-ins from top customer list if desired? 
  -- Usually "Walk-in" dominates, so maybe exclude it or keep it.
  -- Keeping it for now as it shows walk-in volume.
  group by 1
  order by total_spent desc
  limit 10;
$$;
