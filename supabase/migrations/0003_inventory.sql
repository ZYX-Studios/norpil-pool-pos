-- Basic inventory support for tracking product stock over time.
-- We use an append-only movements table instead of storing stock directly on products.
-- This keeps history simple and allows us to compute current stock using a view.

-- === Enums ===
do $$
begin
	if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
		create type inventory_movement_type as enum ('INITIAL', 'PURCHASE', 'SALE', 'ADJUSTMENT');
	end if;
end $$;

-- === Tables ===
create table if not exists inventory_movements (
	id uuid primary key default gen_random_uuid(),
	product_id uuid not null references products(id) on delete cascade,
	movement_type inventory_movement_type not null,
	-- Quantity can be positive (stock in) or negative (stock out).
	quantity integer not null check (quantity <> 0),
	note text,
	-- Optional links back to sales so we can audit where stock went.
	order_id uuid references orders(id) on delete set null,
	order_item_id uuid references order_items(id) on delete set null,
	created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_product on inventory_movements(product_id);
create index if not exists idx_inventory_movements_created_at on inventory_movements(created_at);

-- === RLS ===
alter table inventory_movements enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_movements') then
		create policy inventory_movements_select on inventory_movements for select to authenticated using (true);
		create policy inventory_movements_insert on inventory_movements for insert to authenticated with check (true);
	end if;
end $$;

-- === Views ===
-- Simple current stock per product, based on all movements.
create or replace view product_stock as
select
	p.id as product_id,
	coalesce(sum(m.quantity), 0)::int as quantity_on_hand
from products p
left join inventory_movements m on m.product_id = p.id
group by p.id;





