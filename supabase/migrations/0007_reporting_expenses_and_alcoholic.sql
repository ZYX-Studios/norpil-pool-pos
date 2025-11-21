-- Additional reporting helpers and basic expense tracking
-- to support richer admin /reports views.
--
-- This migration is intentionally small and focused:
-- - Adds an enum + table for operating expenses
-- - Adds a boolean flag on products for alcoholic drinks
-- - Adds SQL helpers for shift-based and alcoholic revenue splits

-- === Enums ===
do $$
begin
	if not exists (select 1 from pg_type where typname = 'expense_category') then
		create type expense_category as enum (
			'RENTAL',
			'UTILITIES',
			'MANPOWER',
			'INVENTORY',
			'BEVERAGES',
			'CLEANING_MATERIALS',
			'TRANSPORTATION',
			'PAYROLL',
			'MARKETING',
			'PREDATOR_COMMISSION',
			'OTHER'
		);
	end if;
end $$;

-- === Tables: expenses ===
create table if not exists expenses (
	id uuid primary key default gen_random_uuid(),
	expense_date date not null,
	category expense_category not null,
	amount numeric(10,2) not null check (amount >= 0),
	note text,
	created_at timestamptz not null default now()
);

alter table expenses enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'expenses') then
		create policy expenses_select on expenses for select to authenticated using (true);
		create policy expenses_insert on expenses for insert to authenticated with check (true);
		-- Updates are allowed so admin can correct mistakes from the SQL console or future UI.
		create policy expenses_update on expenses for update to authenticated using (true) with check (true);
	end if;
end $$;

-- === Products: alcoholic flag for drink-level reporting ===
alter table products
	add column if not exists is_alcoholic boolean not null default false;

create index if not exists idx_products_category_is_alcoholic
	on products(category, is_alcoholic);

-- === Reporting helpers ===
-- 1) Revenue by shift (10:00‑18:00 vs the rest of the day)
--    This follows the same date semantics as other reporting RPCs:
--    p_start and p_end are DATEs; filtering is done on [p_start, p_end + 1 day).
create or replace function revenue_by_shift(p_start date, p_end date)
returns table(shift_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
	select
		case
			-- Morning/first shift: 10:00–18:00 (inclusive start, exclusive end)
			when (pay.paid_at::time >= time '10:00' and pay.paid_at::time < time '18:00')
				then 'Day (10:00–18:00)'
			else 'Night (18:00–10:00)'
		end as shift_name,
		coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status = 'PAID'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1)
	group by 1
	order by 1;
$$;

-- 2) Revenue split for drinks: alcoholic vs non‑alcoholic.
--    Only DRINK category products are included here.
create or replace function revenue_by_drink_type(p_start date, p_end date)
returns table(is_alcoholic boolean, revenue numeric)
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
	)
	select
		p.is_alcoholic,
		coalesce(sum(oi.line_total), 0)::numeric(10,2) as revenue
	from order_items oi
	join products p on p.id = oi.product_id
	join paid_orders po on po.id = oi.order_id
	where p.category = 'DRINK'
	group by p.is_alcoholic;
$$;



