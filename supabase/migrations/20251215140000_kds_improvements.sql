-- KDS Improvements
-- 1. Add SUBMITTED status to track orders sent to kitchen but not yet started
-- 2. Add sent_at column to track when the order was actually sent

begin;
  -- Add value to enum if not exists
  alter type order_status add value if not exists 'SUBMITTED';

  -- Add sent_at column
  alter table orders add column if not exists sent_at timestamptz;

commit;
