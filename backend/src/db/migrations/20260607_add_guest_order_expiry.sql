-- Add expires_at and customer_type to print_orders
ALTER TABLE print_orders
ADD COLUMN expires_at TIMESTAMPTZ,
ADD COLUMN customer_type VARCHAR(50) DEFAULT 'registered';

-- Update existing orders to 'registered' if they have a user_id, else 'guest'
UPDATE print_orders
SET customer_type = CASE WHEN user_id IS NOT NULL THEN 'registered' ELSE 'guest' END;

-- Update schema tracking
INSERT INTO schema_migrations (version) VALUES ('20260607_add_guest_order_expiry');
