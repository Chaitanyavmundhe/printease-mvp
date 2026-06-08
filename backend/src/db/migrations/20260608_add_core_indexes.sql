CREATE INDEX IF NOT EXISTS idx_print_orders_user_id ON print_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_hub_id ON print_orders(hub_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_payment_status ON print_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON print_orders(status);

CREATE INDEX IF NOT EXISTS idx_print_order_files_order_id ON print_order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_print_order_files_document_id ON print_order_files(document_id);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order_id ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_agent_status ON print_jobs(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_hub_status ON print_jobs(hub_id, status);

CREATE INDEX IF NOT EXISTS idx_document_access_logs_document_id ON document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
