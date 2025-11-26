-- Fix missing DELETE policy for inventory_items
-- This allows authenticated users (admins) to delete inventory items.

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'inventory_items_delete') then
		create policy inventory_items_delete on inventory_items for delete to authenticated using (true);
	end if;
end $$;
