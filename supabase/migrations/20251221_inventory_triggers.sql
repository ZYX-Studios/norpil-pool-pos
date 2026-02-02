-- Migration: Inventory Deduction Triggers
-- Purpose: Automatically deduct/reclaim inventory based on order status and item changes.

-- 1. Helper: Deduct Inventory
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_line_item(
    p_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_order_id uuid
)
RETURNS void AS $$
DECLARE
    v_recipe RECORD;
BEGIN
    FOR v_recipe IN 
        SELECT inventory_item_id, quantity 
        FROM product_inventory_recipes 
        WHERE product_id = p_product_id
    LOOP
        INSERT INTO inventory_movements (inventory_item_id, movement_type, quantity, order_id, order_item_id)
        VALUES (v_recipe.inventory_item_id, 'SALE', -(v_recipe.quantity * p_quantity), p_order_id, p_item_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Helper: Reclaim Inventory (Void/Cancel)
CREATE OR REPLACE FUNCTION public.reclaim_inventory_for_line_item(
    p_item_id uuid,
    p_product_id uuid,
    p_quantity numeric,
    p_order_id uuid
)
RETURNS void AS $$
DECLARE
    v_recipe RECORD;
    v_found boolean := false;
BEGIN
    FOR v_recipe IN 
        SELECT inventory_item_id, quantity 
        FROM product_inventory_recipes 
        WHERE product_id = p_product_id
    LOOP
        v_found := true;
        -- Insert debug log if needed, or just perform the action
        -- RAISE WARNING 'Reclaiming: Item % (Qty %), Recipe Qty %', p_product_id, p_quantity, v_recipe.quantity;
        
        INSERT INTO inventory_movements (inventory_item_id, movement_type, quantity, order_id, order_item_id)
        VALUES (v_recipe.inventory_item_id, 'SALE', (v_recipe.quantity * p_quantity), p_order_id, p_item_id);
    END LOOP;
    
    IF NOT v_found THEN
        RAISE WARNING 'Stock Reclaim Failed: No recipe found for Product %', p_product_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: Order Status Change -> SUBMITTED
CREATE OR REPLACE FUNCTION public.trg_handle_order_submit()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- If status changes to SUBMITTED (from OPEN or other non-committed state)
    -- We deduct stock for ALL items in the order.
    -- FIX: Do not re-deduct if we are just transitioning back from PREPARING/SERVED/etc needed for "Send New Items" flow.
    -- those items were already deducted when they were first submitted!
    IF NEW.status = 'SUBMITTED' AND OLD.status NOT IN ('SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'PAID') THEN
        FOR v_item IN SELECT id, product_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            PERFORM public.deduct_inventory_for_line_item(v_item.id, v_item.product_id, v_item.quantity, NEW.id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger: Order Items Changes (Insert/Update/Delete)
CREATE OR REPLACE FUNCTION public.trg_handle_item_changes_on_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_order_status text;
    v_target_order_id uuid;
BEGIN
    v_target_order_id := COALESCE(NEW.order_id, OLD.order_id);
    
    SELECT status INTO v_order_status FROM orders WHERE id = v_target_order_id;

    -- Only act if order is strictly committed
    IF v_order_status IN ('SUBMITTED', 'PREPARING', 'READY', 'SERVED', 'PAID') THEN
        
        -- CASE: INSERT (New item added to submitted order)
        IF (TG_OP = 'INSERT') THEN
            PERFORM public.deduct_inventory_for_line_item(NEW.id, NEW.product_id, NEW.quantity, NEW.order_id);
        
        -- CASE: DELETE (Item voided/removed from submitted order)
        ELSIF (TG_OP = 'DELETE') THEN
            PERFORM public.reclaim_inventory_for_line_item(OLD.id, OLD.product_id, OLD.quantity, OLD.order_id);
            
        -- CASE: UPDATE (Quantity change)
        ELSIF (TG_OP = 'UPDATE') THEN
            -- Difference: New - Old
            -- If +1 (Added): Deduct 1
            -- If -1 (Removed): Reclaim 1
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

-- Apply Triggers

DROP TRIGGER IF EXISTS trg_inventory_on_submit ON orders;
CREATE TRIGGER trg_inventory_on_submit
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'SUBMITTED')
EXECUTE FUNCTION public.trg_handle_order_submit();

DROP TRIGGER IF EXISTS trg_inventory_on_item_change ON order_items;
CREATE TRIGGER trg_inventory_on_item_change
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_handle_item_changes_on_submitted();
