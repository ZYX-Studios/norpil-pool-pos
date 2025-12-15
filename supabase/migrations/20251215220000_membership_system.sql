-- Add Membership Logic

-- 1. Profiles: is_member
alter table profiles 
add column is_member boolean not null default false;

-- 2. Table Sessions: profile_id
alter table table_sessions
add column profile_id uuid references profiles(id);

create index idx_table_sessions_profile on table_sessions(profile_id);

-- 3. settings (app_settings)
create table if not exists app_settings (
    key text primary key,
    value text, -- Store as text or json string
    description text,
    updated_at timestamptz default now()
);

alter table app_settings enable row level security;

-- Policies for app_settings
-- Authenticated users (staff) can read
create policy "Authenticated can read settings" on app_settings
    for select to authenticated using (true);

-- Only admins can write (handled by verify_role or just restricted in app logic, but RLS good practice)
-- Assuming staff has role column
create policy "Admins can update settings" on app_settings
    for all using (
        exists (select 1 from staff where user_id = auth.uid() and role = 'ADMIN')
    );

-- Seed Member Discount Setting
insert into app_settings (key, value, description)
values ('member_discount_percentage', '0', 'Percentage discount for members (0-100)')
on conflict (key) do nothing;
