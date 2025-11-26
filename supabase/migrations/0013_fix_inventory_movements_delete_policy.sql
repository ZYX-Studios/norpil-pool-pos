-- Fix missing DELETE policy for inventory_movements
-- This is required because deleting an inventory_item cascades to inventory_movements.
-- Without this policy, the cascade fails and the item cannot be deleted.

do $$
begin
	if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_movements' and policyname = 'inventory_movements_delete') then
		create policy inventory_movements_delete on inventory_movements for delete to authenticated using (true);
	end if;
end $$;
