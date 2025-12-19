-- Create a unified view for all financial transactions
-- Combines Order Payments and Wallet Top-ups

create or replace view admin_transactions as
select
    p.id as id,
    p.paid_at as created_at,
    p.amount,
    'PAYMENT' as type,
    p.method::text as method,
    coalesce(prof.full_name, sess.customer_name, 'Guest') as customer_name,
    p.order_id as reference_id,
    p.profile_id,
    -- Description: "Order #123 (Table 1)"
    concat('Order #', substring(o.id::text, 1, 8), 
           case when o.table_label is not null then concat(' (', o.table_label, ')') else '' end
    ) as description
from payments p
left join orders o on o.id = p.order_id
left join profiles prof on prof.id = p.profile_id
left join table_sessions sess on sess.id = o.table_session_id

union all

select
    wt.id as id,
    wt.created_at,
    wt.amount,
    'TOPUP' as type,
    'DEPOSIT' as method, -- or 'CASH' if we tracked method for topup? Currently usually Cash.
    coalesce(prof.full_name, 'Unknown User') as customer_name,
    null as reference_id, -- No order ID
    w.profile_id,
    wt.description
from wallet_transactions wt
join wallets w on w.id = wt.wallet_id
left join profiles prof on prof.id = w.profile_id
where wt.type = 'DEPOSIT';

-- Allow RLS on the view (requires underlying tables to be accessible or security definer view)
-- Since views abide by the user's permissions on underlying tables by default, and admins have access, this should be fine.
-- However, for the admin dashboard we often want unrestricted access if the user is verified as admin in app logic.
-- We'll assume the service role or admin user can read these tables.
