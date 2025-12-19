
-- 1. PRE-CLEANUP: Remove "Ghost" Duplicates
DELETE FROM orders o
WHERE o.total = 0
  AND o.status IN ('OPEN', 'SUBMITTED', 'PREPARING')
  AND EXISTS (
      SELECT 1 
      FROM orders sibling 
      WHERE sibling.table_session_id = o.table_session_id 
        AND sibling.id != o.id
        AND sibling.status IN ('PAID', 'SERVED')
  );

-- 2. CONSTRAINT: Unique Active Order per Session
-- A session can have only ONE order that is NOT Paid/Voided.
CREATE UNIQUE INDEX unique_active_order_per_session 
ON orders (table_session_id) 
WHERE status NOT IN ('PAID', 'VOIDED');


-- 3. LOCK: Prevent Modification of PAID Orders
CREATE OR REPLACE FUNCTION check_order_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_status text;
BEGIN
    SELECT status INTO v_status FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    IF v_status = 'PAID' THEN
        RAISE EXCEPTION 'Cannot modify items of a PAID order. Void/Reopen the order first.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lock_paid_order_items
BEFORE INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION check_order_immutability();


-- 4. GUARD: Prevent Deletion of "Committed" Orders
CREATE OR REPLACE FUNCTION prevent_committed_order_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow deletion only if OPEN
    IF OLD.status NOT IN ('OPEN') THEN
         -- Block: SUBMITTED, PREPARING, READY, SERVED, PAID.
         -- Allow VOIDED? Usually yes, if we want to cleanup.
         -- So if status IN ... Block.
         IF OLD.status IN ('SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'PAID') THEN
            RAISE EXCEPTION 'Cannot delete an order that has been Sent to Kitchen or Paid (%). Void it first.', OLD.status;
         END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM payments WHERE order_id = OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete an order with attached payments. Void the payments first.';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_order_deletion
BEFORE DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION prevent_committed_order_deletion();
