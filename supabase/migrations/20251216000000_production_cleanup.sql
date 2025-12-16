-- CLEANUP SCRIPT FOR PRODUCTION LAUNCH
-- ⚠️ THIS WILL DELETE ALL DATA EXCEPT USERS AND STAFF ⚠️

BEGIN;

-- 1. DELETE TRANSACTIONAL DATA (Order matters due to Foreign Keys)
-- ===============================================================
TRUNCATE TABLE public.inventory_movements CASCADE;
TRUNCATE TABLE public.wallet_transactions CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.reservations CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.table_sessions CASCADE;
TRUNCATE TABLE public.cashier_shifts CASCADE;

-- 2. RESET WALLETS
-- ===============================================================
-- Set all wallet balances to 0 but keep the wallet rows so users still have a wallet.
UPDATE public.wallets SET balance = 0;

-- 3. DELETE MASTER DATA (As requested)
-- ===============================================================
DELETE FROM public.products;
DELETE FROM public.pool_tables;

-- 4. OPTIONAL: Categories
-- Leaving categories for now as they provide structure, but can be deleted manually if needed.

COMMIT;
