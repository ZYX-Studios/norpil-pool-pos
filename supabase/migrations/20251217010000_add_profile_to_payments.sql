
-- Add profile_id to payments table to track who made the payment
alter table "public"."payments"
add column "profile_id" uuid references "public"."profiles"("id");

-- Add index for faster lookups by profile
create index if not exists payments_profile_id_idx on "public"."payments" ("profile_id");
