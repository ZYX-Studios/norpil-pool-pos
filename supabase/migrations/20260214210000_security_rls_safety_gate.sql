-- PR3: Security / RLS Safety Gate hardening
-- Goals:
-- 1) Remove overly-broad authenticated policies (using(true)/with check(true)) on core operational tables.
-- 2) Lock down staff table writes to ADMIN/OWNER only.
-- 3) Harden SECURITY DEFINER RPCs with auth + role checks and explicit EXECUTE grants.

-- === Helper auth/role functions ===
-- Note: SECURITY DEFINER is intentional so these helpers can be used inside RLS policies
-- without being blocked by RLS on staff itself.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.user_id = auth.uid()
  );
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.user_id = auth.uid()
      and s.role in ('ADMIN', 'OWNER')
  );
$$;

create or replace function public.assert_staff()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  if not public.is_staff() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_admin_or_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  if not public.is_admin_or_owner() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated, service_role;

revoke all on function public.is_admin_or_owner() from public;
grant execute on function public.is_admin_or_owner() to authenticated, service_role;

revoke all on function public.assert_staff() from public;
grant execute on function public.assert_staff() to authenticated, service_role;

revoke all on function public.assert_admin_or_owner() from public;
grant execute on function public.assert_admin_or_owner() to authenticated, service_role;

-- === RLS policy tightening (core operational tables) ===
-- Add restrictive staff-based policies, then drop overly-broad V1 policies.

-- pool_tables
create policy pool_tables_staff_select on public.pool_tables
  for select to authenticated
  using (public.is_staff());

create policy pool_tables_staff_insert on public.pool_tables
  for insert to authenticated
  with check (public.is_staff());

create policy pool_tables_staff_update on public.pool_tables
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists pool_tables_rw on public.pool_tables;
drop policy if exists pool_tables_ins on public.pool_tables;
drop policy if exists pool_tables_upd on public.pool_tables;

-- table_sessions
create policy table_sessions_staff_select on public.table_sessions
  for select to authenticated
  using (public.is_staff());

create policy table_sessions_staff_insert on public.table_sessions
  for insert to authenticated
  with check (public.is_staff());

create policy table_sessions_staff_update on public.table_sessions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists table_sessions_rw on public.table_sessions;
drop policy if exists table_sessions_ins on public.table_sessions;
drop policy if exists table_sessions_upd on public.table_sessions;

-- products
create policy products_staff_select on public.products
  for select to authenticated
  using (public.is_staff());

create policy products_staff_insert on public.products
  for insert to authenticated
  with check (public.is_staff());

create policy products_staff_update on public.products
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists products_rw on public.products;
drop policy if exists products_ins on public.products;
drop policy if exists products_upd on public.products;

-- orders
create policy orders_staff_select on public.orders
  for select to authenticated
  using (public.is_staff());

create policy orders_staff_insert on public.orders
  for insert to authenticated
  with check (public.is_staff());

create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists orders_rw on public.orders;
drop policy if exists orders_ins on public.orders;
drop policy if exists orders_upd on public.orders;

-- order_items
create policy order_items_staff_select on public.order_items
  for select to authenticated
  using (public.is_staff());

create policy order_items_staff_insert on public.order_items
  for insert to authenticated
  with check (public.is_staff());

create policy order_items_staff_update on public.order_items
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists order_items_rw on public.order_items;
drop policy if exists order_items_ins on public.order_items;
drop policy if exists order_items_upd on public.order_items;

-- payments
create policy payments_staff_select on public.payments
  for select to authenticated
  using (public.is_staff());

create policy payments_staff_insert on public.payments
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists payments_rw on public.payments;
drop policy if exists payments_ins on public.payments;

-- inventory_movements
create policy inventory_movements_staff_select on public.inventory_movements
  for select to authenticated
  using (public.is_staff());

create policy inventory_movements_staff_insert on public.inventory_movements
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists inventory_movements_select on public.inventory_movements;
drop policy if exists inventory_movements_insert on public.inventory_movements;

-- staff table: reads for staff; writes ADMIN/OWNER only
create policy staff_staff_select on public.staff
  for select to authenticated
  using (public.is_staff());

create policy staff_admin_insert on public.staff
  for insert to authenticated
  with check (public.is_admin_or_owner());

create policy staff_admin_update on public.staff
  for update to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

create policy staff_admin_delete on public.staff
  for delete to authenticated
  using (public.is_admin_or_owner());

drop policy if exists staff_rw on public.staff;
drop policy if exists staff_ins on public.staff;
drop policy if exists staff_upd on public.staff;

-- === Harden SECURITY DEFINER RPCs ===

-- Wallet payment: staff-only (POS)
create or replace function public.process_wallet_payment(
  p_code text,
  p_amount numeric,
  p_order_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
  v_balance numeric;
  v_profile_name text;
  v_order_status public.order_status;
begin
  perform public.assert_staff();

  if p_amount is null or p_amount <= 0 then
    return json_build_object('success', false, 'error', 'Invalid amount');
  end if;

  -- Ensure order exists and is not voided
  select o.status into v_order_status
  from public.orders o
  where o.id = p_order_id;

  if v_order_status is null then
    return json_build_object('success', false, 'error', 'Order not found');
  end if;
  if v_order_status = 'VOIDED' then
    return json_build_object('success', false, 'error', 'Order is voided');
  end if;

  -- 1. Validate Code
  select pc.user_id into v_user_id
  from public.payment_codes pc
  where pc.code = p_code
    and pc.status = 'VALID'
    and pc.expires_at > now();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Invalid or expired payment code');
  end if;

  -- 2. Get User Wallet
  select w.id, w.balance into v_wallet_id, v_balance
  from public.wallets w
  where w.profile_id = v_user_id
  for update;

  if v_wallet_id is null then
    return json_build_object('success', false, 'error', 'Customer wallet not found');
  end if;

  if v_balance < p_amount then
    return json_build_object('success', false, 'error', 'Insufficient balance');
  end if;

  -- 3. Get Profile Name (for UI return)
  select p.full_name into v_profile_name
  from public.profiles p
  where p.id = v_user_id;

  -- 4. Mark Code Used
  update public.payment_codes set status = 'USED' where code = p_code;

  -- 5. Deduct Balance & Record Transaction
  update public.wallets
  set balance = balance - p_amount,
      updated_at = now()
  where id = v_wallet_id;

  insert into public.wallet_transactions (wallet_id, amount, type, description, order_id)
  values (
    v_wallet_id,
    -p_amount,
    'PAYMENT',
    'Payment for Order ' || p_order_id,
    p_order_id
  );

  -- 6. Link Order to User
  update public.orders
  set profile_id = v_user_id
  where id = p_order_id;

  return json_build_object(
    'success', true,
    'user_id', v_user_id,
    'customer_name', v_profile_name,
    'new_balance', v_balance - p_amount
  );
exception when others then
  return json_build_object('success', false, 'error', SQLERRM);
end;
$$;

revoke all on function public.process_wallet_payment(text, numeric, uuid) from public;
grant execute on function public.process_wallet_payment(text, numeric, uuid) to authenticated, service_role;

-- Reservation + wallet: caller must be the user, or ADMIN/OWNER
create or replace function public.create_reservation_with_wallet(
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
    if auth.uid() is null then
      return json_build_object('success', false, 'message', 'Unauthorized');
    end if;

    if auth.uid() <> p_user_id and not public.is_admin_or_owner() then
      return json_build_object('success', false, 'message', 'Forbidden');
    end if;

    if p_amount is null or p_amount <= 0 then
      return json_build_object('success', false, 'message', 'Invalid amount');
    end if;

    -- 1. Check Wallet Balance
    select id, balance into v_wallet_id, v_balance
    from public.wallets
    where profile_id = p_user_id
    for update;

    if v_wallet_id is null then
        return json_build_object('success', false, 'message', 'No wallet found');
    end if;

    if v_balance < p_amount then
        return json_build_object('success', false, 'message', 'Insufficient balance');
    end if;

    -- 2. Deduct Balance
    update public.wallets
    set balance = balance - p_amount,
        updated_at = now()
    where id = v_wallet_id;

    insert into public.wallet_transactions (wallet_id, amount, type, description)
    values (v_wallet_id, -p_amount, 'PAYMENT', 'Reservation Payment');

    -- 3. Create Order (OPEN initially)
    insert into public.orders (table_session_id, status, subtotal, tax_total, total, profile_id)
    values (null, 'OPEN', p_amount, 0, p_amount, p_user_id)
    returning id into v_order_id;

    -- 4. Create Order Item (Table Time)
    select id into v_product_id from public.products where name = 'Table Time' limit 1;

    if v_product_id is null then
         insert into public.products (name, sku, category, price)
         values ('Table Time', 'TABLE_TIME', 'TABLE_TIME', 0)
         returning id into v_product_id;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price, line_total)
    values (v_order_id, v_product_id, 1, p_amount, p_amount);

    -- 5. Record Payment
    insert into public.payments (order_id, amount, method, paid_at)
    values (v_order_id, p_amount, 'WALLET', now());

    -- 6. Mark Order PAID
    update public.orders
    set status = 'PAID'
    where id = v_order_id;

    -- 7. Create Reservation
    insert into public.reservations (
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

revoke all on function public.create_reservation_with_wallet(uuid, uuid, timestamptz, timestamptz, int, numeric) from public;
grant execute on function public.create_reservation_with_wallet(uuid, uuid, timestamptz, timestamptz, int, numeric) to authenticated, service_role;

-- Payment code generation: authenticated users only
create or replace function public.generate_payment_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;

  loop
    v_code := floor(random() * 900000 + 100000)::text;

    select exists(
      select 1 from public.payment_codes
      where code = v_code
        and status = 'VALID'
        and expires_at > now()
    ) into v_exists;

    exit when not v_exists;
  end loop;

  update public.payment_codes
  set status = 'EXPIRED'
  where user_id = auth.uid() and status = 'VALID';

  insert into public.payment_codes (code, user_id, expires_at)
  values (v_code, auth.uid(), now() + interval '5 minutes');

  return v_code;
end;
$$;

revoke all on function public.generate_payment_code() from public;
grant execute on function public.generate_payment_code() to authenticated, service_role;

-- Reports / admin RPCs: ADMIN/OWNER only

create or replace function public.get_expenses(p_start date, p_end date)
returns table(
    id uuid,
    expense_date date,
    category expense_category,
    amount numeric,
    note text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
        e.id,
        e.expense_date,
        e.category,
        e.amount,
        e.note
    from public.expenses e
    where e.expense_date >= p_start
      and e.expense_date < (p_end + 1)
    order by e.expense_date;
end;
$$;

revoke all on function public.get_expenses(date, date) from public;
grant execute on function public.get_expenses(date, date) to authenticated, service_role;

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  perform public.assert_admin_or_owner();

  select u.id into v_user_id
  from auth.users u
  where u.email = p_email;

  return v_user_id;
end;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to authenticated, service_role;

create or replace function public.get_report_transactions(p_start timestamptz, p_end timestamptz)
returns table (
  id uuid,
  amount numeric,
  method text,
  paid_at timestamptz,
  type text,
  description text,
  customer_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    with sales as (
      select
        p.id,
        p.amount,
        p.method::text,
        p.paid_at,
        'SALE' as type,
        case
          when pt.name is not null then pt.name
          when r_pt.name is not null then r_pt.name
          else 'Order'
        end as description,
        coalesce(prof.full_name, ts.customer_name, 'Walk-in') as customer_name
      from public.payments p
      join public.orders o on o.id = p.order_id
      left join public.table_sessions ts on ts.id = o.table_session_id
      left join public.pool_tables pt on pt.id = ts.pool_table_id
      left join public.reservations r on r.id = o.reservation_id
      left join public.pool_tables r_pt on r_pt.id = r.pool_table_id
      left join public.profiles prof on prof.id = o.profile_id
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
      from public.wallet_transactions wt
      join public.wallets w on w.id = wt.wallet_id
      left join public.profiles prof on prof.id = w.profile_id
      where wt.type = 'DEPOSIT'
        and wt.created_at >= p_start and wt.created_at < p_end
    )
    select * from sales
    union all
    select * from deposits
    order by paid_at desc;
end;
$$;

revoke all on function public.get_report_transactions(timestamptz, timestamptz) from public;
grant execute on function public.get_report_transactions(timestamptz, timestamptz) to authenticated, service_role;

-- Standardized reporting functions (ADMIN/OWNER only)

create or replace function public.total_revenue(p_start date, p_end date)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  perform public.assert_admin_or_owner();

  select
    coalesce(sum(least(pay.amount, nullif(o.total, 0))), 0)
  into v_total
  from public.payments pay
  join public.orders o on o.id = pay.order_id
  where o.status in ('PAID', 'SERVED')
    and o.status != 'VOIDED'
    and public.get_business_date(pay.paid_at) >= p_start
    and public.get_business_date(pay.paid_at) <= p_end;

  return v_total;
end;
$$;

revoke all on function public.total_revenue(date, date) from public;
grant execute on function public.total_revenue(date, date) to authenticated, service_role;

create or replace function public.revenue_by_category(p_start date, p_end date)
returns table(category text, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      case
        when o.table_session_id is not null and p.name = 'Table Time' then 'TABLE_TIME'
        when p.category = 'DRINK' then 'DRINK'
        when p.category = 'FOOD' then 'FOOD'
        else 'OTHER'
      end as category,
      sum(i.line_total) as revenue
    from public.order_items i
    join public.orders o on o.id = i.order_id
    join public.payments pay on pay.order_id = o.id
    left join public.products p on p.id = i.product_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by revenue desc;
end;
$$;

revoke all on function public.revenue_by_category(date, date) from public;
grant execute on function public.revenue_by_category(date, date) to authenticated, service_role;

create or replace function public.revenue_by_method(p_start date, p_end date)
returns table(method text, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      pay.method::text,
      sum(least(pay.amount, nullif(o.total, 0))) as revenue
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by revenue desc;
end;
$$;

revoke all on function public.revenue_by_method(date, date) from public;
grant execute on function public.revenue_by_method(date, date) to authenticated, service_role;

create or replace function public.revenue_by_shift(p_start date, p_end date)
returns table(shift_name text, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      case
        when (pay.paid_at at time zone 'Asia/Manila')::time >= '10:00:00'::time
         and (pay.paid_at at time zone 'Asia/Manila')::time < '18:00:00'::time
        then 'Day Shift'
        else 'Night Shift'
      end as shift_name,
      sum(least(pay.amount, nullif(o.total, 0))) as revenue
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by revenue desc;
end;
$$;

revoke all on function public.revenue_by_shift(date, date) from public;
grant execute on function public.revenue_by_shift(date, date) to authenticated, service_role;

create or replace function public.daily_revenue(p_start date, p_end date)
returns table(date text, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      to_char(public.get_business_date(pay.paid_at), 'YYYY-MM-DD') as date,
      sum(least(pay.amount, nullif(o.total, 0))) as revenue
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by date asc;
end;
$$;

revoke all on function public.daily_revenue(date, date) from public;
grant execute on function public.daily_revenue(date, date) to authenticated, service_role;

create or replace function public.revenue_by_hour(p_start date, p_end date)
returns table(hour int, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      extract(hour from (pay.paid_at at time zone 'Asia/Manila'))::int as hour,
      sum(least(pay.amount, nullif(o.total, 0))) as revenue
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by 1;
end;
$$;

revoke all on function public.revenue_by_hour(date, date) from public;
grant execute on function public.revenue_by_hour(date, date) to authenticated, service_role;

create or replace function public.revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      coalesce(pt.name, ts.location_name, 'Walk-in') as table_name,
      sum(least(pay.amount, nullif(o.total, 0))) as revenue
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    join public.table_sessions ts on ts.id = o.table_session_id
    left join public.pool_tables pt on pt.id = ts.pool_table_id
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by revenue desc;
end;
$$;

revoke all on function public.revenue_by_table(date, date) from public;
grant execute on function public.revenue_by_table(date, date) to authenticated, service_role;

create or replace function public.monthly_financial_summary(p_start date, p_end date)
returns table(
  month text,
  total_revenue numeric,
  total_expenses numeric,
  net_profit numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    with sales as (
      select
        to_char(public.get_business_date(pay.paid_at), 'YYYY-MM') as m,
        sum(least(pay.amount, nullif(o.total, 0))) as rev
      from public.payments pay
      join public.orders o on o.id = pay.order_id
      where o.status in ('PAID', 'SERVED')
        and o.status != 'VOIDED'
        and public.get_business_date(pay.paid_at) >= p_start
        and public.get_business_date(pay.paid_at) <= p_end
      group by 1
    ),
    costs as (
      select
        to_char(e.expense_date, 'YYYY-MM') as m,
        sum(e.amount) as exp
      from public.expenses e
      where e.expense_date >= p_start
        and e.expense_date <= p_end
      group by 1
    )
    select
      coalesce(s.m, c.m) as month,
      coalesce(s.rev, 0) as total_revenue,
      coalesce(c.exp, 0) as total_expenses,
      (coalesce(s.rev, 0) - coalesce(c.exp, 0)) as net_profit
    from sales s
    full outer join costs c on s.m = c.m
    order by 1 desc;
end;
$$;

revoke all on function public.monthly_financial_summary(date, date) from public;
grant execute on function public.monthly_financial_summary(date, date) to authenticated, service_role;

create or replace function public.get_top_customers(p_start date, p_end date)
returns table(customer_name text, total_spent numeric, visit_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_or_owner();

  return query
    select
      coalesce(p.full_name, ts.customer_name, 'Walk-in') as customer_name,
      sum(least(pay.amount, nullif(o.total, 0))) as total_spent,
      count(distinct ts.id) as visit_count
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    join public.table_sessions ts on ts.id = o.table_session_id
    left join public.profiles p on p.id = ts.opened_by
    where o.status in ('PAID', 'SERVED')
      and o.status != 'VOIDED'
      and public.get_business_date(pay.paid_at) >= p_start
      and public.get_business_date(pay.paid_at) <= p_end
    group by 1
    order by total_spent desc
    limit 10;
end;
$$;

revoke all on function public.get_top_customers(date, date) from public;
grant execute on function public.get_top_customers(date, date) to authenticated, service_role;
