-- Compatibility only: allow values already emitted by current controllers.
-- No rows, payment state, or tokens are changed. NOT VALID keeps legacy rows
-- from blocking rollout while enforcing the checks on every subsequent write.
-- Audit historical values before separately VALIDATE CONSTRAINT in production.
ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_payment_status_check;
ALTER TABLE print_orders ADD CONSTRAINT print_orders_payment_status_check CHECK (
  payment_status IS NULL OR payment_status IN (
    'draft', 'not_requested', 'pending', 'requested', 'verified', 'collected',
    'paid', 'failed', 'expired', 'cancelled'
  )
) NOT VALID;

ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_status_check;
ALTER TABLE agents ADD CONSTRAINT agents_status_check CHECK (
  status IN ('pending', 'active', 'online', 'offline', 'busy', 'error', 'unknown', 'revoked', 'paused')
) NOT VALID;

ALTER TABLE agent_pairing_sessions DROP CONSTRAINT IF EXISTS agent_pairing_sessions_status_check;
ALTER TABLE agent_pairing_sessions ADD CONSTRAINT agent_pairing_sessions_status_check CHECK (
  status IN ('pending', 'claimed', 'approved', 'confirmed', 'rejected', 'expired')
) NOT VALID;
