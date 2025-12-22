CREATE OR REPLACE FUNCTION public.trg_handle_item_changes_on_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_order_status text;
    v_target_order_id uuid;
BEGIN
    v_target_order_id := COALESCE(NEW.order_id, OLD.order_id);
    
    SELECT status INTO v_order_status FROM orders WHERE id = v_target_order_id;

    IF v_order_status IN ('SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'PAID') THEN
        
        IF (TG_OP = 'INSERT') THEN
            PERFORM public.deduct_inventory_for_line_item(NEW.id, NEW.product_id, NEW.quantity, NEW.order_id);
        
        ELSIF (TG_OP = 'DELETE') THEN
            -- Pass NULL as item_id because the item is being deleted, preventing FK violation
            PERFORM public.reclaim_inventory_for_line_item(NULL, OLD.product_id, OLD.quantity, OLD.order_id);
            
        ELSIF (TG_OP = 'UPDATE') THEN
            IF NEW.quantity > OLD.quantity THEN
                PERFORM public.deduct_inventory_for_line_item(NEW.id, NEW.product_id, (NEW.quantity - OLD.quantity), NEW.order_id);
            ELSIF NEW.quantity < OLD.quantity THEN
                PERFORM public.reclaim_inventory_for_line_item(NEW.id, NEW.product_id, (OLD.quantity - NEW.quantity), NEW.order_id);
            END IF;
        END IF;
        
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
