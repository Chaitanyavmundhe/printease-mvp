DO $$
BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_hubs ADD CONSTRAINT print_hubs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE printers ADD CONSTRAINT printers_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_orders ADD CONSTRAINT print_orders_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_tokens ADD CONSTRAINT agent_tokens_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_pairing_sessions ADD CONSTRAINT agent_pairing_sessions_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_pairing_sessions ADD CONSTRAINT agent_pairing_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_printers ADD CONSTRAINT agent_printers_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE agent_printers ADD CONSTRAINT agent_printers_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES print_hubs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_job_events ADD CONSTRAINT print_job_events_print_job_id_fkey FOREIGN KEY (print_job_id) REFERENCES print_jobs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_job_events ADD CONSTRAINT print_job_events_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_order_files ADD CONSTRAINT print_order_files_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE print_order_files ADD CONSTRAINT print_order_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_access_logs ADD CONSTRAINT document_access_logs_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_access_logs ADD CONSTRAINT document_access_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE document_access_logs ADD CONSTRAINT document_access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
