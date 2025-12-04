-- === Enums ===
-- Add WALLET to payment_method if it doesn't exist
-- Note: ALTER TYPE cannot be run inside a DO block easily for enum values in all postgres versions, 
-- but we can try to add it if not exists.
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'WALLET';

-- === Tables ===

-- 1. Profiles
-- Extends auth.users with app-specific info
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    phone_number text,
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Wallets
-- One wallet per profile
create table if not exists wallets (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade unique,
    balance numeric(10,2) not null default 0 check (balance >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3. Wallet Transactions
-- History of top-ups and spends
create type wallet_transaction_type as enum ('DEPOSIT', 'PAYMENT', 'REFUND', 'ADJUSTMENT');

create table if not exists wallet_transactions (
    id uuid primary key default gen_random_uuid(),
    wallet_id uuid not null references wallets(id) on delete cascade,
    amount numeric(10,2) not null, -- Positive for deposit, negative for payment
    type wallet_transaction_type not null,
    reference_id uuid, -- Can point to an order_id or payment_id
    description text,
    created_at timestamptz not null default now()
);

-- 4. Reservations
create type reservation_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

create table if not exists reservations (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade,
    pool_table_id uuid references pool_tables(id), -- Optional, can be assigned later
    start_time timestamptz not null,
    end_time timestamptz not null,
    status reservation_status not null default 'PENDING',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 5. Update Orders
-- Link orders to profiles (optional, as walk-ins don't have profiles)
alter table orders 
    add column if not exists profile_id uuid references profiles(id);

-- === RLS ===

alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table reservations enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on profiles
    for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
    for update using (auth.uid() = id);

create policy "Staff can view all profiles" on profiles
    for select using (
        exists (select 1 from staff where user_id = auth.uid())
    );

-- Wallets Policies
create policy "Users can view own wallet" on wallets
    for select using (
        exists (select 1 from profiles where id = wallets.profile_id and id = auth.uid())
    );

create policy "Staff can view all wallets" on wallets
    for select using (
        exists (select 1 from staff where user_id = auth.uid())
    );

-- Wallet Transactions Policies
create policy "Users can view own transactions" on wallet_transactions
    for select using (
        exists (select 1 from wallets where id = wallet_transactions.wallet_id and profile_id = auth.uid())
    );

-- Reservations Policies
create policy "Users can view own reservations" on reservations
    for select using (
        profile_id = auth.uid()
    );

create policy "Users can create reservations" on reservations
    for insert with check (
        profile_id = auth.uid()
    );

create policy "Staff can view all reservations" on reservations
    for select using (
        exists (select 1 from staff where user_id = auth.uid())
    );

create policy "Staff can update reservations" on reservations
    for update using (
        exists (select 1 from staff where user_id = auth.uid())
    );

-- === Triggers ===

-- Auto-create profile and wallet on user signup (optional, but good for UX)
-- For now, we'll handle it in the app or a separate trigger if needed.
-- Let's add a trigger to update updated_at columns

create trigger trg_profiles_updated_at
    before update on profiles
    for each row execute function set_orders_updated_at(); -- Reusing existing function

create trigger trg_wallets_updated_at
    before update on wallets
    for each row execute function set_orders_updated_at();

create trigger trg_reservations_updated_at
    before update on reservations
    for each row execute function set_orders_updated_at();

-- Trigger to create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  insert into public.wallets (profile_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

-- Check if trigger exists before creating to avoid errors on re-runs
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;
