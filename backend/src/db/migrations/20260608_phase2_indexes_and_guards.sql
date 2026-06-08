CREATE INDEX IF NOT EXISTS idx_print_orders_guest_token ON print_orders(guest_token);
CREATE INDEX IF NOT EXISTS idx_print_orders_expires_at ON print_orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_print_job_events_print_job_id ON print_job_events(print_job_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_print_job_per_order
ON print_jobs(order_id)
WHERE status IN ('queued', 'accepted', 'downloading', 'printing');
