-- Create cashier_shifts table
create table if not exists cashier_shifts (
    id uuid primary key default gen_random_uuid(),
    staff_id uuid references staff(id), -- Optional link to staff profile if needed, but we rely on created_by (auth.uid) mostly
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    starting_cash numeric(10,2) not null default 0,
    expected_cash numeric(10,2), -- Calculated by system when closing
    actual_cash numeric(10,2), -- Input by user
    difference numeric(10,2), -- actual - expected
    notes text,
    created_by uuid references auth.users(id) default auth.uid()
);

-- RLS for cashier_shifts
alter table cashier_shifts enable row level security;

create policy "Users can view their own shifts"
    on cashier_shifts for select
    to authenticated
    using (created_by = auth.uid());

create policy "Admins can view all shifts"
    on cashier_shifts for select
    to authenticated
    using (
        exists (
            select 1 from staff
            where staff.user_id = auth.uid()
            and staff.role = 'ADMIN'
        )
    );

create policy "Users can insert their own shifts"
    on cashier_shifts for insert
    to authenticated
    with check (created_by = auth.uid());

create policy "Users can update their own shifts"
    on cashier_shifts for update
    to authenticated
    using (created_by = auth.uid());


-- Add created_by to payments
alter table payments add column if not exists created_by uuid references auth.users(id) default auth.uid();

-- RLS for payments needs to allow insert with created_by.
-- Existing policies might be "true" for authenticated, which is fine.
-- But we want to ensure created_by is set to auth.uid() if not provided (default handles this).
-- If existing policy is broad (using true), it should be fine.

-- Index for searching payments by user (for end shift calculation)
create index if not exists idx_payments_created_by on payments(created_by);
create index if not exists idx_payments_paid_at_created_by on payments(paid_at, created_by);

-- Helper RPC to calculate expected cash for a shift
-- We can do this in code, but an RPC is safer/faster to aggregate.
create or replace function get_shift_payments_total(p_user_id uuid, p_start timestamptz, p_end timestamptz default now())
returns numeric
language sql
security definer
set search_path = public
as $$
    select coalesce(sum(amount), 0)::numeric(10,2)
    from payments
    where created_by = p_user_id
      and paid_at >= p_start
      and paid_at <= p_end
      and method = 'CASH'; -- Only count CASH for the "Cash Handoff". Other methods are just digital records.
$$;
