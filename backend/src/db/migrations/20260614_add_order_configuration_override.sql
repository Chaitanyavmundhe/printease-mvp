-- Add order configuration override metadata and audit events.
-- Column types are derived from the live target tables so this migration works
-- on databases where primary keys are uuid as well as older text-key databases.

ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_version integer NOT NULL DEFAULT 1;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_role text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_at timestamptz;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_config_source text;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_locked_at timestamptz;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS config_lock_reason text;

DO $$
DECLARE
  order_id_type text;
  user_id_type text;
  hub_id_type text;
  current_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO order_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_orders'
      AND a.attname = 'id'
      AND NOT a.attisdropped
    LIMIT 1;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO user_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'users'
      AND a.attname = 'id'
      AND NOT a.attisdropped
    LIMIT 1;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO hub_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_hubs'
      AND a.attname = 'id'
      AND NOT a.attisdropped
    LIMIT 1;

  order_id_type := COALESCE(order_id_type, 'text');
  user_id_type := COALESCE(user_id_type, 'text');
  hub_id_type := COALESCE(hub_id_type, 'text');

  ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_latest_configured_by_user_id_fkey;
  ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_latest_configured_by_hub_id_fkey;

  EXECUTE format('ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_user_id %s', user_id_type);
  EXECUTE format('ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS latest_configured_by_hub_id %s', hub_id_type);

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_orders'
      AND a.attname = 'latest_configured_by_user_id'
      AND NOT a.attisdropped
    LIMIT 1;
  IF current_type IS NOT NULL AND current_type <> user_id_type THEN
    EXECUTE format(
      'ALTER TABLE print_orders ALTER COLUMN latest_configured_by_user_id TYPE %s USING latest_configured_by_user_id::%s',
      user_id_type,
      user_id_type
    );
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_orders'
      AND a.attname = 'latest_configured_by_hub_id'
      AND NOT a.attisdropped
    LIMIT 1;
  IF current_type IS NOT NULL AND current_type <> hub_id_type THEN
    EXECUTE format(
      'ALTER TABLE print_orders ALTER COLUMN latest_configured_by_hub_id TYPE %s USING latest_configured_by_hub_id::%s',
      hub_id_type,
      hub_id_type
    );
  END IF;

  ALTER TABLE print_orders
    ADD CONSTRAINT print_orders_latest_configured_by_user_id_fkey
    FOREIGN KEY (latest_configured_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE print_orders
    ADD CONSTRAINT print_orders_latest_configured_by_hub_id_fkey
    FOREIGN KEY (latest_configured_by_hub_id) REFERENCES print_hubs(id) ON DELETE SET NULL;

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS print_order_config_events (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      order_id %1$s NOT NULL,
      actor_role text NOT NULL,
      actor_user_id %2$s,
      actor_hub_id %3$s,
      event_type text NOT NULL,
      previous_config jsonb,
      new_config jsonb NOT NULL,
      previous_price_snapshot jsonb,
      new_price_snapshot jsonb,
      previous_amount_paise integer,
      new_amount_paise integer,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  $sql$, order_id_type, user_id_type, hub_id_type);

  ALTER TABLE print_order_config_events DROP CONSTRAINT IF EXISTS print_order_config_events_order_id_fkey;
  ALTER TABLE print_order_config_events DROP CONSTRAINT IF EXISTS print_order_config_events_actor_user_id_fkey;
  ALTER TABLE print_order_config_events DROP CONSTRAINT IF EXISTS print_order_config_events_actor_hub_id_fkey;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_order_config_events'
      AND a.attname = 'order_id'
      AND NOT a.attisdropped
    LIMIT 1;
  IF current_type IS NOT NULL AND current_type <> order_id_type THEN
    EXECUTE format(
      'ALTER TABLE print_order_config_events ALTER COLUMN order_id TYPE %s USING order_id::%s',
      order_id_type,
      order_id_type
    );
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_order_config_events'
      AND a.attname = 'actor_user_id'
      AND NOT a.attisdropped
    LIMIT 1;
  IF current_type IS NOT NULL AND current_type <> user_id_type THEN
    EXECUTE format(
      'ALTER TABLE print_order_config_events ALTER COLUMN actor_user_id TYPE %s USING actor_user_id::%s',
      user_id_type,
      user_id_type
    );
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'print_order_config_events'
      AND a.attname = 'actor_hub_id'
      AND NOT a.attisdropped
    LIMIT 1;
  IF current_type IS NOT NULL AND current_type <> hub_id_type THEN
    EXECUTE format(
      'ALTER TABLE print_order_config_events ALTER COLUMN actor_hub_id TYPE %s USING actor_hub_id::%s',
      hub_id_type,
      hub_id_type
    );
  END IF;

  ALTER TABLE print_order_config_events
    ADD CONSTRAINT print_order_config_events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
  ALTER TABLE print_order_config_events
    ADD CONSTRAINT print_order_config_events_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE print_order_config_events
    ADD CONSTRAINT print_order_config_events_actor_hub_id_fkey
    FOREIGN KEY (actor_hub_id) REFERENCES print_hubs(id) ON DELETE SET NULL;
END $$;

ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS chk_print_orders_latest_configured_by_role;
ALTER TABLE print_orders
  ADD CONSTRAINT chk_print_orders_latest_configured_by_role
  CHECK (latest_configured_by_role IN ('user', 'hub', 'system')) NOT VALID;

ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS chk_print_orders_latest_config_source;
ALTER TABLE print_orders
  ADD CONSTRAINT chk_print_orders_latest_config_source
  CHECK (latest_config_source IN ('initial_user', 'hub_manual_override', 'system_default', 'reprint_prefill')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_print_order_config_events_order_id ON print_order_config_events(order_id);
CREATE INDEX IF NOT EXISTS idx_print_order_config_events_created_at ON print_order_config_events(created_at);
CREATE INDEX IF NOT EXISTS idx_print_orders_latest_configured_by_hub_id ON print_orders(latest_configured_by_hub_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_config_version ON print_orders(config_version);

ALTER TABLE print_order_config_events DROP CONSTRAINT IF EXISTS chk_print_order_config_events_actor_role;
ALTER TABLE print_order_config_events
  ADD CONSTRAINT chk_print_order_config_events_actor_role
  CHECK (actor_role IN ('user', 'hub', 'system')) NOT VALID;
