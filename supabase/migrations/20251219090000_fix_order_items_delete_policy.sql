
-- Add DELETE policy for order_items explicitly
create policy "order_items_del" on order_items 
    for delete 
    to authenticated 
    using (true);
