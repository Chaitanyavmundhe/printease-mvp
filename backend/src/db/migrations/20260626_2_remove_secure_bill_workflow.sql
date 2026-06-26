-- Remove secure bill workflow columns and constraints

ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_bill_status_check;
ALTER TABLE print_orders DROP COLUMN IF EXISTS bill_status;
ALTER TABLE print_orders DROP COLUMN IF EXISTS hub_confirmed_total_paise;
ALTER TABLE print_orders DROP COLUMN IF EXISTS bill_hash;

-- Restore simple payment_status and status if needed. 
-- Assuming they are already correct from previous updates, we just ensure no constraints block standard flow.
