-- Allow inventory_movements to be used with inventory_item_id alone.
-- In the initial design product_id was NOT NULL. After introducing
-- inventory_items, new movements are written against inventory_item_id
-- and do not always have a product_id. To avoid NOT NULL violations
-- (code 23502) we relax the constraint here.

alter table inventory_movements
	alter column product_id drop not null;




