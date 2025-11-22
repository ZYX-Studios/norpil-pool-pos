-- Track how much cash the guest actually handed over, separate from revenue.
-- Revenue continues to use payments.amount (applied to the order).

alter table payments
	add column if not exists tendered_amount numeric(10,2);

-- Backfill existing rows so historical data stays consistent.
update payments
set tendered_amount = amount
where tendered_amount is null;





