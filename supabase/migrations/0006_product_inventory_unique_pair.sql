-- Ensure each product + inventory_item pair appears at most once in recipes.
-- This keeps recipe management simple and allows clean upserts.

alter table product_inventory_recipes
	add constraint product_inventory_unique_pair unique (product_id, inventory_item_id);





