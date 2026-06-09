-- Alter print_orders table to support configuration overrides
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_version integer NOT NULL DEFAULT 1;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_role text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_user_id text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_hub_id text REFERENCES print_hubs(id) ON DELETE SET NULL;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_at timestamptz;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_config_source text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_locked_at timestamptz;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_lock_reason text;

-- Add check constraints as NOT VALID to prevent issues with historical un-audited records
ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS chk_print_orders_latest_configured_by_role;
ALTER TABLE print_orders ADD CONSTRAINT chk_print_orders_latest_configured_by_role CHECK (latest_configured_by_role IN ('user', 'hub', 'system')) NOT VALID;

ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS chk_print_orders_latest_config_source;
ALTER TABLE print_orders ADD CONSTRAINT chk_print_orders_latest_config_source CHECK (latest_config_source IN ('initial_user', 'hub_manual_override', 'system_default', 'reprint_prefill')) NOT VALID;

-- Create print_order_config_events table
CREATE TABLE IF NOT EXISTS print_order_config_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL REFERENCES print_orders(id) ON DELETE CASCADE,
  actor_role text NOT NULL,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  actor_hub_id text REFERENCES print_hubs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_config jsonb,
  new_config jsonb NOT NULL,
  previous_price_snapshot jsonb,
  new_price_snapshot jsonb,
  previous_amount_paise integer,
  new_amount_paise integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index constraints
CREATE INDEX IF NOT EXISTS idx_print_order_config_events_order_id ON print_order_config_events(order_id);
CREATE INDEX IF NOT EXISTS idx_print_order_config_events_created_at ON print_order_config_events(created_at);
CREATE INDEX IF NOT EXISTS idx_print_orders_latest_configured_by_hub_id ON print_orders(latest_configured_by_hub_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_config_version ON print_orders(config_version);

-- Event check constraint
ALTER TABLE print_order_config_events DROP CONSTRAINT IF EXISTS chk_print_order_config_events_actor_role;
ALTER TABLE print_order_config_events ADD CONSTRAINT chk_print_order_config_events_actor_role CHECK (actor_role IN ('user', 'hub', 'system')) NOT VALID;
