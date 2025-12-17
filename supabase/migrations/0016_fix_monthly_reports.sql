-- Migration: Fix Monthly and Margin Reports Logic
-- Issue: Matches 0015. "Gross Sales" uses flawed logic in daily/monthly/margin views.
-- Fix: Apply the same LEAST(payment, total) and Status check logic to these functions.

-- Drop existing functions to prevent return type errors
drop function if exists daily_revenue(date, date);
drop function if exists margin_by_category(date, date);
drop function if exists margin_by_drink_type(date, date);
drop function if exists monthly_financial_summary(date, date);

-- 1. Daily Revenue Trend
create or replace function daily_revenue(p_start date, p_end date)
returns table(day date, revenue numeric)
language sql
security definer
set search_path = public
as $$
	with date_series as (
		select generate_series(p_start, p_end, interval '1 day')::date as day
	),
	revenue_per_day as (
		select
			pay.paid_at::date as day,
			coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2) as revenue
		from payments pay
		join orders o on o.id = pay.order_id
		where o.status in ('PAID', 'SERVED')
		  and o.status != 'VOIDED'
          and o.status != 'CANCELLED'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
		group by pay.paid_at::date
	)
	select
		ds.day,
		coalesce(rpd.revenue, 0)::numeric(10,2) as revenue
	from date_series ds
	left join revenue_per_day rpd on rpd.day = ds.day
	order by ds.day;
$$;

-- 2. Margin by Category
create or replace function margin_by_category(p_start date, p_end date)
returns table(category product_category, revenue numeric, cost numeric, margin numeric)
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
          and o.status != 'CANCELLED'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
	),
	per_item as (
		select
			p.category,
			oi.id as order_item_id,
			oi.quantity,
			oi.line_total as revenue,
			coalesce(sum(ii.unit_cost * pir.quantity), 0)::numeric(10,2) as unit_cost_sum
		from order_items oi
		join products p on p.id = oi.product_id
		join paid_orders po on po.id = oi.order_id
		left join product_inventory_recipes pir on pir.product_id = p.id
		left join inventory_items ii on ii.id = pir.inventory_item_id
		group by p.category, oi.id, oi.quantity, oi.line_total
	)
	select
		category,
		coalesce(sum(revenue), 0)::numeric(10,2) as revenue,
		coalesce(sum(unit_cost_sum * quantity), 0)::numeric(10,2) as cost,
		coalesce(sum(revenue - unit_cost_sum * quantity), 0)::numeric(10,2) as margin
	from per_item
	group by category
	order by category;
$$;

-- 3. Margin by Drink Type
create or replace function margin_by_drink_type(p_start date, p_end date)
returns table(is_alcoholic boolean, revenue numeric, cost numeric, margin numeric)
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
          and o.status != 'CANCELLED'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
	),
	per_item as (
		select
			p.is_alcoholic,
			oi.id as order_item_id,
			oi.quantity,
			oi.line_total as revenue,
			coalesce(sum(ii.unit_cost * pir.quantity), 0)::numeric(10,2) as unit_cost_sum
		from order_items oi
		join products p on p.id = oi.product_id
		join paid_orders po on po.id = oi.order_id
		left join product_inventory_recipes pir on pir.product_id = p.id
		left join inventory_items ii on ii.id = pir.inventory_item_id
		where p.category = 'DRINK'
		group by p.is_alcoholic, oi.id, oi.quantity, oi.line_total
	)
	select
		is_alcoholic,
		coalesce(sum(revenue), 0)::numeric(10,2) as revenue,
		coalesce(sum(unit_cost_sum * quantity), 0)::numeric(10,2) as cost,
		coalesce(sum(revenue - unit_cost_sum * quantity), 0)::numeric(10,2) as margin
	from per_item
	group by is_alcoholic
	order by is_alcoholic desc;
$$;

-- 4. Monthly Financial Summary
create or replace function monthly_financial_summary(p_start date, p_end date)
returns table(month_start date, revenue numeric, expenses numeric, net numeric)
language sql
security definer
set search_path = public
as $$
	with months as (
		select generate_series(
			date_trunc('month', p_start)::date,
			date_trunc('month', p_end)::date,
			interval '1 month'
		) ::date as month_start
	),
	revenue_per_month as (
		select
			date_trunc('month', pay.paid_at)::date as month_start,
			coalesce(sum(least(pay.amount, o.total)), 0)::numeric(10,2) as revenue
		from payments pay
		join orders o on o.id = pay.order_id
		where o.status in ('PAID', 'SERVED')
		  and o.status != 'VOIDED'
          and o.status != 'CANCELLED'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
		group by date_trunc('month', pay.paid_at)::date
	),
	expenses_per_month as (
		select
			date_trunc('month', e.expense_date)::date as month_start,
			coalesce(sum(e.amount), 0)::numeric(10,2) as expenses
		from expenses e
		where e.expense_date >= p_start
		  and e.expense_date <= p_end
		group by date_trunc('month', e.expense_date)::date
	)
	select
		m.month_start,
		coalesce(rpm.revenue, 0)::numeric(10,2) as revenue,
		coalesce(epm.expenses, 0)::numeric(10,2) as expenses,
		coalesce(coalesce(rpm.revenue, 0) - coalesce(epm.expenses, 0), 0)::numeric(10,2) as net
	from months m
	left join revenue_per_month rpm on rpm.month_start = m.month_start
	left join expenses_per_month epm on epm.month_start = m.month_start
	order by m.month_start;
$$;
