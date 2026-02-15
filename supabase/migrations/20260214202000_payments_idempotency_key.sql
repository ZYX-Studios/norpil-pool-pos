-- Add idempotency to payments to make recording safe on retries/double-clicks.

alter table public.payments
	add column if not exists idempotency_key text;

-- Unique, but only when present (keeps existing rows valid).
create unique index if not exists payments_idempotency_key_uniq
	on public.payments (idempotency_key)
	where idempotency_key is not null;
