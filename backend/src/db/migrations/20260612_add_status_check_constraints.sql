-- Add defaults safely
ALTER TABLE print_orders ALTER COLUMN payment_status SET DEFAULT 'draft';
ALTER TABLE print_orders ALTER COLUMN customer_type SET DEFAULT 'registered';
ALTER TABLE agents ALTER COLUMN paused SET DEFAULT false;
ALTER TABLE agent_printers ALTER COLUMN is_default SET DEFAULT false;
ALTER TABLE agent_printers ALTER COLUMN status SET DEFAULT 'unknown';

-- Add CHECK constraints safely (idempotent blocks)
DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'hub', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_payment_status_check CHECK (
    payment_status IS NULL OR
    payment_status IN ('draft', 'pending', 'verified', 'collected', 'failed', 'expired', 'cancelled')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_customer_type_check CHECK (
    customer_type IS NULL OR
    customer_type IN ('guest', 'registered')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_status_check CHECK (
    status IN ('pending', 'active', 'offline', 'revoked', 'paused')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_pairing_sessions ADD CONSTRAINT agent_pairing_sessions_status_check CHECK (
    status IN ('pending', 'claimed', 'approved', 'rejected', 'expired')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check CHECK (
    status IN ('queued', 'accepted', 'downloading', 'printing', 'completed', 'failed', 'cancelled')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
