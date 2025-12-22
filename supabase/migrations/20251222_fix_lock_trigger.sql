CREATE OR REPLACE FUNCTION public.trg_lock_paid_order_items()
RETURNS TRIGGER AS $$
DECLARE
    v_status text;
BEGIN
    SELECT status INTO v_status FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    IF v_status = 'PAID' THEN
        RAISE EXCEPTION 'Cannot modify items of a PAID order. Void/Reopen the order first.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
