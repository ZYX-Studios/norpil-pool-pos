-- Fix for RLS policy violation on wallet_transactions
-- The original schema did not include an INSERT policy for authenticated users, causing mobile orders to fail when recording the transaction.

create policy "Users can insert own wallet transactions" on wallet_transactions
    for insert with check (
        exists (select 1 from wallets where id = wallet_id and profile_id = auth.uid())
    );
