-- Fix create_reservation_with_wallet to avoid "Cannot modify items of a PAID order" error
-- We must create the order as OPEN first, insert items, then mark as PAID.

create or replace function create_reservation_with_wallet(
    p_user_id uuid,
    p_pool_table_id uuid,
    p_start_time timestamptz,
    p_end_time timestamptz,
    p_guest_count int,
    p_amount numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_wallet_id uuid;
    v_balance numeric;
    v_res_id uuid;
    v_order_id uuid;
    v_product_id uuid;
begin
    -- 1. Check Wallet Balance
    select id, balance into v_wallet_id, v_balance
    from wallets 
    where profile_id = p_user_id 
    for update;
    
    if v_wallet_id is null then 
        return json_build_object('success', false, 'message', 'No wallet found'); 
    end if;
    
    if v_balance < p_amount then 
        return json_build_object('success', false, 'message', 'Insufficient balance'); 
    end if;
    
    -- 2. Deduct Balance
    update wallets 
    set balance = balance - p_amount, 
        updated_at = now() 
    where id = v_wallet_id;
    
    insert into wallet_transactions (wallet_id, amount, type, description)
    values (v_wallet_id, -p_amount, 'PAYMENT', 'Reservation Payment');
    
    -- 3. Create Order (Status: OPEN initially to allow item insertion)
    -- We set table_session_id to NULL since it's a future booking.
    insert into orders (table_session_id, status, subtotal, tax_total, total, profile_id)
    values (null, 'OPEN', p_amount, 0, p_amount, p_user_id)
    returning id into v_order_id;
    
    -- 4. Create Order Item (Table Time)
    select id into v_product_id from products where name = 'Table Time' limit 1;
    
    if v_product_id is null then 
         -- Fallback: Should exist from init, but safety first
         insert into products (name, sku, category, price) 
         values ('Table Time', 'TABLE_TIME', 'TABLE_TIME', 0) 
         returning id into v_product_id;
    end if;
    
    insert into order_items (order_id, product_id, quantity, unit_price, line_total)
    values (v_order_id, v_product_id, 1, p_amount, p_amount);
    
    -- 5. Record Payment (Method: WALLET)
    -- This makes it appear in 'total_revenue' and 'daily_revenue' reports.
    insert into payments (order_id, amount, method, paid_at)
    values (v_order_id, p_amount, 'WALLET', now());

    -- 6. Update Order Status to PAID
    -- Now that items are added, we can safely lock the order.
    update orders 
    set status = 'PAID' 
    where id = v_order_id;
    
    -- 7. Create Reservation
    insert into reservations (
        profile_id, 
        pool_table_id, 
        start_time, 
        end_time, 
        status, 
        payment_status, 
        order_id
    )
    values (
        p_user_id, 
        p_pool_table_id, 
        p_start_time, 
        p_end_time, 
        'CONFIRMED', 
        'PAID', 
        v_order_id
    )
    returning id into v_res_id;
    
    return json_build_object('success', true, 'reservation_id', v_res_id);
exception when others then
    return json_build_object('success', false, 'message', SQLERRM);
end;
$$;
