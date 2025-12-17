-- Migration: Fix Reports Revenue Logic
-- Issue: 
-- 1. "Gross Sales" under-reported because it filtered only 'PAID' status, excluding 'SERVED' orders (Wallet payments).
-- 2. "Gross Sales" over-reported because it summed raw Payment Amount, catching overpayments (e.g. 90k payment for 647 order).
-- Fix:
-- 1. Relax status check to include 'SERVED'.
-- 2. Use LEAST(payment.amount, order.total) to cap revenue contribution at the actual order value.
-- 3. Drop existing functions to allow return type changes/updates.

-- Drop existing functions to prevent "cannot change return type" errors
drop function if exists total_revenue(date, date);
drop function if exists revenue_by_method(date, date);
drop function if exists revenue_by_category(date, date);
drop function if exists revenue_by_table(date, date);

-- 1. Total Revenue (Gross Sales)
create or replace function total_revenue(p_start date, p_end date)
returns numeric
language sql
security definer
set search_path = public
as $$
	select coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2)
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status in ('PAID', 'SERVED') -- Include both closed and served/open-but-paid
	  and o.status != 'VOIDED'           -- Explicitly exclude voided
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1);
$$;

-- 2. Revenue by Method
create or replace function revenue_by_method(p_start date, p_end date)
returns table(method payment_method, revenue numeric)
language sql
security definer
set search_path = public
as $$
	select pay.method, coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2) as revenue
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status in ('PAID', 'SERVED')
	  and o.status != 'VOIDED'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1)
	group by pay.method
	order by pay.method;
$$;

-- 3. Revenue by Category
-- Kept logic to "Any payment triggers full order count" but fixed Status filter.
create or replace function revenue_by_category(p_start date, p_end date)
returns table(category product_category, revenue numeric)
language sql
security definer
set search_path = public
as $$
	with paid_orders as (
		select distinct o.id
		from orders o
		join payments pay on pay.order_id = o.id
		where o.status in ('PAID', 'SERVED')
	      and o.status != 'VOIDED'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
	)
	select p.category, coalesce(sum(oi.line_total), 0)::numeric(10,2) as revenue
	from order_items oi
	join products p on p.id = oi.product_id
	join paid_orders po on po.id = oi.order_id
	group by p.category
	order by p.category;
$$;

-- 4. Revenue by Table (Operations)
-- Align status filter with others.
create or replace function revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
    select 
        coalesce(pt.name, 'Walk-in / Other') as table_name,
        coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2) as revenue
    from payments pay
    join orders o on o.id = pay.order_id
    left join table_sessions ts on ts.id = o.table_session_id
    left join pool_tables pt on pt.id = ts.pool_table_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and pay.paid_at >= p_start
      and pay.paid_at < (p_end + 1)
    group by pt.name
    order by revenue desc;
$$;
