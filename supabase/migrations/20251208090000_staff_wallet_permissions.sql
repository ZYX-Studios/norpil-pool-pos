-- Give staff permission to update wallets (to add balance)
create policy "Staff can update all wallets" on wallets
    for update using (
        exists (select 1 from staff where user_id = auth.uid())
    );

-- Give staff permission to insert wallet transactions (to record top-ups)
create policy "Staff can insert wallet transactions" on wallet_transactions
    for insert with check (
        exists (select 1 from staff where user_id = auth.uid())
    );

-- Users can also view their own transactions (already exists but good to verify)
-- Existing policy: "Users can view own transactions"
