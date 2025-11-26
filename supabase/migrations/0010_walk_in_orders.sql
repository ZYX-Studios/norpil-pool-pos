-- Allow table_sessions to have no pool_table_id (for walk-ins)
alter table table_sessions alter column pool_table_id drop not null;

-- Add customer_name to track who the walk-in is for
alter table table_sessions add column if not exists customer_name text;

-- Add index for customer name search if needed later
create index if not exists idx_table_sessions_customer_name on table_sessions(customer_name);
