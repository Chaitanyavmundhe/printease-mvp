-- Add secure bill workflow columns
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS hub_confirmed_total_paise integer;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS bill_hash text;

-- Drop existing constraints
ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_payment_status_check;
ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_status_check;

-- Map old payment_status to new ones
UPDATE print_orders
SET payment_status = CASE
  WHEN payment_status IN ('draft') THEN 'not_requested'
  WHEN payment_status IN ('pending') THEN 'requested'
  WHEN payment_status IN ('verified', 'paid') THEN 'verified'
  WHEN payment_status IN ('collected') THEN 'collected'
  WHEN payment_status IN ('failed', 'expired', 'cancelled') THEN 'failed'
  ELSE 'not_requested'
END;

-- Map old status to new ones
UPDATE print_orders
SET status = CASE
  WHEN status IN ('Draft', 'Payment Pending') THEN 'awaiting_hub_bill_confirmation'
  WHEN status IN ('Payment Verified', 'Payment Collected') THEN 'payment_collected'
  WHEN status IN ('Accepted by Centre', 'Queued for Printing', 'Paused') THEN 'queued_for_print'
  WHEN status IN ('Sent to Agent', 'Printing') THEN 'printing'
  WHEN status IN ('Ready for Pickup', 'Collected') THEN 'completed'
  WHEN status IN ('Cancelled') THEN 'cancelled'
  WHEN status IN ('Printing Failed', 'Refund Requested') THEN 'failed'
  ELSE 'awaiting_hub_bill_confirmation'
END;

-- Set default values correctly
ALTER TABLE print_orders ALTER COLUMN payment_status SET DEFAULT 'not_requested';
ALTER TABLE print_orders ALTER COLUMN status SET DEFAULT 'draft_uploaded';

-- Add check constraints
DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_payment_status_check CHECK (
    payment_status IS NULL OR
    payment_status IN ('not_requested', 'requested', 'collected', 'verified', 'failed')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_status_check CHECK (
    status IS NULL OR
    status IN (
      'draft_uploaded',
      'awaiting_hub_bill_confirmation',
      'bill_confirmed',
      'payment_requested',
      'payment_collected',
      'queued_for_print',
      'printing',
      'completed',
      'failed',
      'cancelled'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
