-- Per-category and per-drink-type margin helpers plus monthly summary.
-- This builds on existing inventory_items + product_inventory_recipes
-- to estimate cost of goods sold (COGS) for each sold line item and
-- adds a monthly financial overview for big-picture reporting.

-- We keep the model intentionally simple:
-- - inventory_items.unit_cost stores cost per unit of the inventory item
-- - product_inventory_recipes.quantity describes how many units are used
--   per 1 unit of product
-- - For each order_item, cost = (sum(unit_cost * recipe_quantity)) * quantity

-- === Inventory item costing ===
alter table inventory_items
	add column if not exists unit_cost numeric(10,2) not null default 0;

-- === Margins by product category ===
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
		where o.status = 'PAID'
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

-- === Margins for alcoholic vs non-alcoholic drinks ===
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
		where o.status = 'PAID'
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

-- === Monthly financial overview ===
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
			coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue
		from payments pay
		join orders o on o.id = pay.order_id
		where o.status = 'PAID'
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





