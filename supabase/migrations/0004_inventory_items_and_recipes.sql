-- Move inventory to a more flexible model:
-- - inventory_items: physical stock (bottles, units, ingredients)
-- - product_inventory_recipes: how each product consumes inventory_items
-- - inventory_movements now point at inventory_items instead of products
-- - product_stock is computed from recipes + inventory_item_stock

-- === Tables: inventory_items ===
create table if not exists inventory_items (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	sku text unique,
	unit text not null default 'PCS',
	is_active boolean not null default true,
	created_at timestamptz not null default now()
);

alter table inventory_items enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_items') then
		create policy inventory_items_select on inventory_items for select to authenticated using (true);
		create policy inventory_items_insert on inventory_items for insert to authenticated with check (true);
		create policy inventory_items_update on inventory_items for update to authenticated using (true) with check (true);
	end if;
end $$;

-- === Tables: product_inventory_recipes ===
-- Each row says: 1 unit of product_id consumes `quantity` units of inventory_item_id.
create table if not exists product_inventory_recipes (
	id uuid primary key default gen_random_uuid(),
	product_id uuid not null references products(id) on delete cascade,
	inventory_item_id uuid not null references inventory_items(id) on delete cascade,
	quantity numeric(10,4) not null check (quantity > 0)
);

create index if not exists idx_pir_product on product_inventory_recipes(product_id);
create index if not exists idx_pir_inventory_item on product_inventory_recipes(inventory_item_id);

alter table product_inventory_recipes enable row level security;

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_inventory_recipes') then
		create policy pir_select on product_inventory_recipes for select to authenticated using (true);
		create policy pir_insert on product_inventory_recipes for insert to authenticated with check (true);
		create policy pir_update on product_inventory_recipes for update to authenticated using (true) with check (true);
	end if;
end $$;

-- === Inventory movements: add inventory_item_id ===
-- We keep product_id for now for backwards compatibility but new code should use inventory_item_id.
alter table inventory_movements
	add column if not exists inventory_item_id uuid references inventory_items(id) on delete cascade;

create index if not exists idx_inventory_movements_inventory_item on inventory_movements(inventory_item_id);

-- === Views: inventory_item_stock ===
create or replace view inventory_item_stock as
select
	ii.id as inventory_item_id,
	coalesce(sum(m.quantity), 0)::int as quantity_on_hand
from inventory_items ii
left join inventory_movements m on m.inventory_item_id = ii.id
group by ii.id;

-- === Views: product_stock (replace previous simple view) ===
-- For each product, stock is the minimum possible units given all its recipe components.
create or replace view product_stock as
with per_component as (
	select
		p.id as product_id,
		-- If there is no stock row yet, treat as zero.
		case
			when iis.quantity_on_hand is null then 0
			else floor(iis.quantity_on_hand::numeric / pir.quantity)::int
		end as possible_units
	from products p
	join product_inventory_recipes pir on pir.product_id = p.id
	left join inventory_item_stock iis on iis.inventory_item_id = pir.inventory_item_id
),
aggregated as (
	select
		product_id,
		min(possible_units) as quantity_on_hand
	from per_component
	group by product_id
)
select
	p.id as product_id,
	coalesce(a.quantity_on_hand, 0)::int as quantity_on_hand
from products p
left join aggregated a on a.product_id = p.id;

-- === Seed helpers: basic 1:1 mappings for existing products ===
-- For existing non-TABLE_TIME products, create an inventory_item and a simple recipe.
-- This keeps current behaviour: selling 1 product decrements its own stock by 1 unit.

-- 1) Create inventory_items for products that do not yet have a matching inventory item (by SKU).
insert into inventory_items (name, sku, unit, is_active)
select
	p.name,
	p.sku,
	'PCS' as unit,
	p.is_active
from products p
left join inventory_items ii on ii.sku is not distinct from p.sku
where p.category <> 'TABLE_TIME'
	and ii.id is null;

-- 2) Create recipes: 1 unit of product uses 1 unit of the matching inventory_item.
insert into product_inventory_recipes (product_id, inventory_item_id, quantity)
select
	p.id,
	ii.id,
	1::numeric(10,4) as quantity
from products p
join inventory_items ii on ii.sku is not distinct from p.sku
left join product_inventory_recipes pir on pir.product_id = p.id
where p.category <> 'TABLE_TIME'
	and pir.id is null;





