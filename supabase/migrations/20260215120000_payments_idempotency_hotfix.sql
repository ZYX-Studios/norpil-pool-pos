-- Hotfix: Ensure idempotency_key column exists on payments table
-- This migration is idempotent and safe to run multiple times.

-- 1. Ensure column exists
ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "idempotency_key" text;

-- 2. Drop potential bad indexes (partial index or wrong name)
DROP INDEX IF EXISTS "public"."payments_idempotency_key_uniq";
DROP INDEX IF EXISTS "public"."payments_idempotency_key_key";

-- 3. Create the correct unique index
CREATE UNIQUE INDEX "payments_idempotency_key_uniq"
ON "public"."payments" ("idempotency_key");
