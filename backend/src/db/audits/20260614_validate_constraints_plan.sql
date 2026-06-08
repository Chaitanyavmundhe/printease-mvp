-- Phase 8: Validate Constraints Plan
-- DO NOT RUN ALL OF THIS AT ONCE
-- This script contains queries to discover orphans, and statements to validate constraints safely.

-- ==========================================
-- 1. Discovery: List NOT VALID constraints
-- ==========================================
SELECT
  conname,
  conrelid::regclass::text AS table_name,
  contype,
  convalidated
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND convalidated = false
ORDER BY table_name, conname;

-- ==========================================
-- 2. Pre-flight Checks: Find Orphan Records
-- ==========================================

-- Orphan documents (e.g., referenced user does not exist)
SELECT d.* FROM documents d LEFT JOIN users u ON d.user_id = u.id WHERE d.user_id IS NOT NULL AND u.id IS NULL;

-- Orphan print orders (missing users or hubs)
SELECT po.* FROM print_orders po LEFT JOIN users u ON po.user_id = u.id WHERE po.user_id IS NOT NULL AND u.id IS NULL;
SELECT po.* FROM print_orders po LEFT JOIN print_hubs h ON po.hub_id = h.id WHERE po.hub_id IS NOT NULL AND h.id IS NULL;

-- Orphan payments (missing orders)
SELECT p.* FROM payments p LEFT JOIN print_orders po ON p.order_id = po.id WHERE po.id IS NULL;

-- Orphan agents (missing hubs)
SELECT a.* FROM agents a LEFT JOIN print_hubs h ON a.hub_id = h.id WHERE a.hub_id IS NOT NULL AND h.id IS NULL;

-- Orphan print jobs (missing orders or agents)
SELECT pj.* FROM print_jobs pj LEFT JOIN print_orders po ON pj.order_id = po.id WHERE po.id IS NULL;
SELECT pj.* FROM print_jobs pj LEFT JOIN agents a ON pj.agent_id = a.id WHERE pj.agent_id IS NOT NULL AND a.id IS NULL;

-- Orphan print_job_events
SELECT pje.* FROM print_job_events pje LEFT JOIN print_jobs pj ON pje.print_job_id = pj.id WHERE pj.id IS NULL;

-- Orphan print_order_files
SELECT pof.* FROM print_order_files pof LEFT JOIN print_orders po ON pof.order_id = po.id WHERE po.id IS NULL;
SELECT pof.* FROM print_order_files pof LEFT JOIN documents d ON pof.document_id = d.id WHERE d.id IS NULL;

-- ==========================================
-- 3. Validation: Run these ONLY IF the queries above return 0 rows
-- ==========================================

/*
ALTER TABLE documents VALIDATE CONSTRAINT documents_user_id_fkey;
ALTER TABLE print_hubs VALIDATE CONSTRAINT print_hubs_owner_id_fkey;
ALTER TABLE printers VALIDATE CONSTRAINT printers_hub_id_fkey;

ALTER TABLE print_orders VALIDATE CONSTRAINT print_orders_user_id_fkey;
ALTER TABLE print_orders VALIDATE CONSTRAINT print_orders_hub_id_fkey;
ALTER TABLE print_orders VALIDATE CONSTRAINT print_orders_payment_status_check;
ALTER TABLE print_orders VALIDATE CONSTRAINT print_orders_customer_type_check;

ALTER TABLE payments VALIDATE CONSTRAINT payments_order_id_fkey;

ALTER TABLE agents VALIDATE CONSTRAINT agents_hub_id_fkey;
ALTER TABLE agents VALIDATE CONSTRAINT agents_status_check;

ALTER TABLE agent_tokens VALIDATE CONSTRAINT agent_tokens_agent_id_fkey;

ALTER TABLE agent_pairing_sessions VALIDATE CONSTRAINT agent_pairing_sessions_hub_id_fkey;
ALTER TABLE agent_pairing_sessions VALIDATE CONSTRAINT agent_pairing_sessions_agent_id_fkey;
ALTER TABLE agent_pairing_sessions VALIDATE CONSTRAINT agent_pairing_sessions_status_check;

ALTER TABLE agent_printers VALIDATE CONSTRAINT agent_printers_agent_id_fkey;
ALTER TABLE agent_printers VALIDATE CONSTRAINT agent_printers_hub_id_fkey;
ALTER TABLE agent_printers VALIDATE CONSTRAINT agent_printers_status_check;

ALTER TABLE print_jobs VALIDATE CONSTRAINT print_jobs_order_id_fkey;
ALTER TABLE print_jobs VALIDATE CONSTRAINT print_jobs_hub_id_fkey;
ALTER TABLE print_jobs VALIDATE CONSTRAINT print_jobs_agent_id_fkey;
ALTER TABLE print_jobs VALIDATE CONSTRAINT print_jobs_status_check;

ALTER TABLE print_job_events VALIDATE CONSTRAINT print_job_events_print_job_id_fkey;
ALTER TABLE print_job_events VALIDATE CONSTRAINT print_job_events_agent_id_fkey;

ALTER TABLE print_order_files VALIDATE CONSTRAINT print_order_files_order_id_fkey;
ALTER TABLE print_order_files VALIDATE CONSTRAINT print_order_files_document_id_fkey;

ALTER TABLE document_access_logs VALIDATE CONSTRAINT document_access_logs_document_id_fkey;
ALTER TABLE document_access_logs VALIDATE CONSTRAINT document_access_logs_order_id_fkey;
ALTER TABLE document_access_logs VALIDATE CONSTRAINT document_access_logs_user_id_fkey;

*/
