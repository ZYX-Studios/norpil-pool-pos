-- Enable required extensions
create extension if not exists "pgcrypto";

-- === Enums ===
do $$
begin
	if not exists (select 1 from pg_type where typname = 'staff_role') then
		create type staff_role as enum ('ADMIN', 'CASHIER', 'WAITER');
	end if;
	if not exists (select 1 from pg_type where typname = 'session_status') then
		create type session_status as enum ('OPEN', 'CLOSED', 'CANCELLED');
	end if;
	if not exists (select 1 from pg_type where typname = 'product_category') then
		create type product_category as enum ('FOOD', 'DRINK', 'OTHER', 'TABLE_TIME');
	end if;
	if not exists (select 1 from pg_type where typname = 'order_status') then
		create type order_status as enum ('OPEN', 'PAID', 'VOIDED');
	end if;
	if not exists (select 1 from pg_type where typname = 'payment_method') then
		create type payment_method as enum ('CASH', 'GCASH', 'CARD', 'OTHER');
	end if;
end $$;

-- === Tables ===
create table if not exists pool_tables (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	is_active boolean not null default true,
	hourly_rate numeric(10,2) not null
);

create table if not exists staff (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	name text not null,
	role staff_role not null
);

create table if not exists table_sessions (
	id uuid primary key default gen_random_uuid(),
	pool_table_id uuid not null references pool_tables(id),
	status session_status not null default 'OPEN',
	opened_at timestamptz not null default now(),
	closed_at timestamptz,
	opened_by uuid references staff(id),
	closed_by uuid references staff(id),
	override_hourly_rate numeric(10,2),
	notes text
);
create index if not exists idx_table_sessions_table on table_sessions(pool_table_id);
create index if not exists idx_table_sessions_status on table_sessions(status);

create table if not exists products (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	sku text unique,
	category product_category not null,
	price numeric(10,2) not null,
	tax_rate numeric(5,4) not null default 0.12,
	is_active boolean not null default true
);
create index if not exists idx_products_active on products(is_active);
create index if not exists idx_products_category on products(category);

create table if not exists orders (
	id uuid primary key default gen_random_uuid(),
	table_session_id uuid not null references table_sessions(id),
	status order_status not null default 'OPEN',
	subtotal numeric(10,2) not null default 0,
	tax_total numeric(10,2) not null default 0,
	service_charge numeric(10,2) not null default 0,
	discount_amount numeric(10,2) not null default 0,
	discount_reason text,
	total numeric(10,2) not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
create index if not exists idx_orders_session on orders(table_session_id);
create index if not exists idx_orders_status on orders(status);

create table if not exists order_items (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references orders(id) on delete cascade,
	product_id uuid not null references products(id),
	quantity int not null check (quantity > 0),
	unit_price numeric(10,2) not null,
	line_total numeric(10,2) not null,
	created_at timestamptz not null default now()
);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_product on order_items(product_id);

create table if not exists payments (
	id uuid primary key default gen_random_uuid(),
	order_id uuid not null references orders(id) on delete cascade,
	amount numeric(10,2) not null check (amount >= 0),
	method payment_method not null,
	reference text,
	paid_at timestamptz not null default now()
);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_payments_paid_at on payments(paid_at);

-- === Triggers ===
create or replace function set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists trg_orders_set_updated_at on orders;
create trigger trg_orders_set_updated_at
before update on orders
for each row
execute function set_orders_updated_at();

-- === RLS ===
alter table pool_tables enable row level security;
alter table staff enable row level security;
alter table table_sessions enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;

-- Authenticated users can read/write operational tables (V1)
do $$
begin
	-- pool_tables
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pool_tables') then
		create policy pool_tables_rw on pool_tables for select to authenticated using (true);
		create policy pool_tables_ins on pool_tables for insert to authenticated with check (true);
		create policy pool_tables_upd on pool_tables for update to authenticated using (true) with check (true);
	end if;
	-- staff (will be restricted later)
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff') then
		create policy staff_rw on staff for select to authenticated using (true);
		create policy staff_ins on staff for insert to authenticated with check (true);
		create policy staff_upd on staff for update to authenticated using (true) with check (true);
	end if;
	-- table_sessions
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'table_sessions') then
		create policy table_sessions_rw on table_sessions for select to authenticated using (true);
		create policy table_sessions_ins on table_sessions for insert to authenticated with check (true);
		create policy table_sessions_upd on table_sessions for update to authenticated using (true) with check (true);
	end if;
	-- products
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products') then
		create policy products_rw on products for select to authenticated using (true);
		create policy products_ins on products for insert to authenticated with check (true);
		create policy products_upd on products for update to authenticated using (true) with check (true);
	end if;
	-- orders
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders') then
		create policy orders_rw on orders for select to authenticated using (true);
		create policy orders_ins on orders for insert to authenticated with check (true);
		create policy orders_upd on orders for update to authenticated using (true) with check (true);
	end if;
	-- order_items
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items') then
		create policy order_items_rw on order_items for select to authenticated using (true);
		create policy order_items_ins on order_items for insert to authenticated with check (true);
		create policy order_items_upd on order_items for update to authenticated using (true) with check (true);
	end if;
	-- payments
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payments') then
		create policy payments_rw on payments for select to authenticated using (true);
		create policy payments_ins on payments for insert to authenticated with check (true);
	end if;
end $$;

-- === Seed: Table Time Product ===
insert into products (name, sku, category, price, tax_rate, is_active)
values ('Table Time', 'TABLE_TIME', 'TABLE_TIME', 0, 0.12, true)
on conflict (sku) do nothing;

-- === Reporting RPCs (simple, assumes single full payment per order) ===
create or replace function total_revenue(p_start date, p_end date)
returns numeric
language sql
security definer
set search_path = public
as $$
	select coalesce(sum(pay.amount), 0)::numeric(10,2)
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status = 'PAID'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1);
$$;

create or replace function revenue_by_method(p_start date, p_end date)
returns table(method payment_method, revenue numeric)
language sql
security definer
set search_path = public
as $$
	select pay.method, coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status = 'PAID'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1)
	group by pay.method
	order by pay.method;
$$;

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
		where o.status = 'PAID'
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







