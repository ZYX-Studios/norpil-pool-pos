-- Add created_by to wallet_transactions to track who processed the top-up (Cashier)
alter table wallet_transactions add column if not exists created_by uuid references auth.users(id) default auth.uid();

-- Indexes for performance
create index if not exists idx_wallet_transactions_created_by on wallet_transactions(created_by);
create index if not exists idx_wallet_transactions_date_created_by on wallet_transactions(created_at, created_by);

-- Update the RPC to include wallet deposits in the shift total
create or replace function get_shift_payments_total(p_user_id uuid, p_start timestamptz, p_end timestamptz default now())
returns numeric
language sql
security definer
set search_path = public
as $$
    select (
        -- 1. Total Cash Payments from Orders
        coalesce((
            select sum(amount)
            from payments
            where created_by = p_user_id
              and paid_at >= p_start
              and paid_at <= p_end
              and method = 'CASH'
        ), 0)
        +
        -- 2. Total Cash Top-ups (Wallet Deposits handled by this cashier)
        coalesce((
             select sum(amount)
             from wallet_transactions
             where created_by = p_user_id
               and created_at >= p_start
               and created_at <= p_end
               and type = 'DEPOSIT'
        ), 0)
    )::numeric(10,2);
$$;
