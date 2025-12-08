-- Enable RLS on payment_codes
alter table payment_codes enable row level security;

-- Allow users to view their own codes (needed for Realtime subscription)
create policy "Users can view own payment codes"
on payment_codes for select
to authenticated
using (auth.uid() = user_id);

-- Add table to supabase_realtime publication to enable listening
alter publication supabase_realtime add table payment_codes;
