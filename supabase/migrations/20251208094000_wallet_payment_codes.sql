-- Add order_id to wallet_transactions for linking payments
alter table wallet_transactions 
add column if not exists order_id uuid references orders(id);

-- Create payment_codes table
create type payment_code_status as enum ('VALID', 'USED', 'EXPIRED');

create table if not exists payment_codes (
  code text primary key,
  user_id uuid not null references auth.users(id),
  expires_at timestamp with time zone not null,
  status payment_code_status not null default 'VALID',
  created_at timestamp with time zone default now()
);

-- Index for faster lookups
create index if not exists idx_payment_codes_user on payment_codes(user_id);

-- RPC to generate a secure random code
create or replace function generate_payment_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    -- Generate 6 digit code
    v_code := floor(random() * 900000 + 100000)::text;
    
    -- Check uniqueness among valid codes
    select exists(
      select 1 from payment_codes 
      where code = v_code 
      and status = 'VALID' 
      and expires_at > now()
    ) into v_exists;
    
    exit when not v_exists;
  end loop;

  -- Invalidate old codes for this user
  update payment_codes 
  set status = 'EXPIRED' 
  where user_id = auth.uid() and status = 'VALID';

  -- Insert new code (valid for 5 mins)
  insert into payment_codes (code, user_id, expires_at)
  values (v_code, auth.uid(), now() + interval '5 minutes');

  return v_code;
end;
$$;

-- RPC to process wallet payment securely
create or replace function process_wallet_payment(
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
begin
  -- 1. Validate Code
  select user_id into v_user_id
  from payment_codes
  where code = p_code 
  and status = 'VALID' 
  and expires_at > now();

  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Invalid or expired payment code');
  end if;

  -- 2. Get User Wallet
  select id, balance into v_wallet_id, v_balance
  from wallets
  where profile_id = v_user_id
  for update; -- Lock wallet row

  if v_wallet_id is null then
    return json_build_object('success', false, 'error', 'Customer wallet not found');
  end if;

  if v_balance < p_amount then
    return json_build_object('success', false, 'error', 'Insufficient balance');
  end if;

  -- 3. Get Profile Name (for UI return)
  select full_name into v_profile_name from profiles where id = v_user_id;

  -- 4. Mark Code Used
  update payment_codes set status = 'USED' where code = p_code;

  -- 5. Deduct Balance & Record Transaction
  update wallets 
  set balance = balance - p_amount, 
      updated_at = now()
  where id = v_wallet_id;

  insert into wallet_transactions (wallet_id, amount, type, description, order_id)
  values (
    v_wallet_id, 
    -p_amount, 
    'PAYMENT', 
    'Payment for Order ' || p_order_id, 
    p_order_id
  );

  -- 6. Link Order to User (Critical for tracking)
  update orders 
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
