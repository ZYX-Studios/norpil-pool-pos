-- Fix missing DELETE policy for product_inventory_recipes
-- This allows authenticated users (admins) to remove ingredients from a product.

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_inventory_recipes' and policyname = 'pir_delete') then
		create policy pir_delete on product_inventory_recipes for delete to authenticated using (true);
	end if;
end $$;
