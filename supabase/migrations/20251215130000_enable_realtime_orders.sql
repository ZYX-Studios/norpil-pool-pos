-- Enable Realtime for orders and order_items
-- This allows the KDS to receive updates instantly without refreshing.

begin;
  -- Add tables to the publication
  -- We use 'alter publication ... add table' which is idempotent in newer Postgres, 
  -- but strictly, if it's already there it might throw an error or notice.
  -- To be safe and simple:
  
  alter publication supabase_realtime add table orders;
  alter publication supabase_realtime add table order_items;

commit;
