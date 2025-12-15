-- Function to fetch combined transactions (Sales + Deposits) for reports
-- Bypasses RLS to ensure accurate reporting of all financial activity

create or replace function get_report_transactions(p_start timestamptz, p_end timestamptz)
returns table (
  id uuid,
  amount numeric,
  method text,
  paid_at timestamptz,
  type text, -- 'SALE' or 'DEPOSIT'
  description text,
  customer_name text
)
language sql
security definer
set search_path = public
as $$
  with sales as (
    select
      p.id,
      p.amount,
      p.method,
      p.paid_at,
      'SALE' as type,
      -- Logic to determine description based on table, reservation, or simple order
      case 
        when pt.name is not null then pt.name
        when r_pt.name is not null then r_pt.name
        else 'Order'
      end as description,
      -- Logic to determine customer name
      coalesce(prof.full_name, ts.customer_name, 'Walk-in') as customer_name
    from payments p
    join orders o on o.id = p.order_id
    left join table_sessions ts on ts.id = o.table_session_id
    left join pool_tables pt on pt.id = ts.pool_table_id
    left join reservations r on r.id = o.reservation_id
    left join pool_tables r_pt on r_pt.id = r.pool_table_id
    left join profiles prof on prof.id = o.profile_id
    where p.paid_at >= p_start and p.paid_at < p_end
  ),
  deposits as (
    select
      wt.id,
      wt.amount,
      'WALLET_TOPUP' as method,
      wt.created_at as paid_at,
      'DEPOSIT' as type,
      'Wallet Deposit' as description,
      coalesce(prof.full_name, 'Unknown User') as customer_name
    from wallet_transactions wt
    join wallets w on w.id = wt.wallet_id
    left join profiles prof on prof.id = w.profile_id
    where wt.type = 'DEPOSIT'
      and wt.created_at >= p_start and wt.created_at < p_end
  )
  select * from sales
  union all
  select * from deposits
  order by paid_at desc;
$$;
