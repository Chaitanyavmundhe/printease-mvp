-- Add bill_status column
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS bill_status text DEFAULT 'awaiting_hub_confirmation';

-- Update check constraints
DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_bill_status_check CHECK (
    bill_status IS NULL OR
    bill_status IN (
      'awaiting_hub_confirmation',
      'confirmed',
      'mismatch'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
