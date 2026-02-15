-- Hotfix: Ensure idempotency_key column exists on payments table
-- This migration is idempotent and safe to run multiple times.

ALTER TABLE "public"."payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key" ON "public"."payments" ("idempotency_key");
