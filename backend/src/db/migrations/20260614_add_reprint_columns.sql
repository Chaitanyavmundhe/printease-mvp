-- Add reprint logic columns to print_orders table

ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS reprint_of_order_id text REFERENCES print_orders(id) ON DELETE SET NULL;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS reprint_source text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS source_document_status text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS original_order_code_snapshot text;
