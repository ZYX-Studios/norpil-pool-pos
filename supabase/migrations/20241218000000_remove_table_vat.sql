-- Update the tax_rate for 'Table Time' product to 0
-- This ensures that table time charges are treated as VAT-inclusive or non-taxable
UPDATE products
SET tax_rate = 0
WHERE name = 'Table Time';
