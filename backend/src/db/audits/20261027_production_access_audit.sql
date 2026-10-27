-- Read-only operator audit. No customer records, credentials or file paths.
-- A table grant can be intentional when RLS protects it; review both together.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- Inspect the document bucket only; do not expose any storage object keys.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'documents';

SELECT t.relname AS table_name, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND c.conname IN (
  'agents_status_check', 'agent_pairing_sessions_status_check',
  'print_orders_payment_status_check'
)
ORDER BY t.relname, c.conname;

-- No automatic normalization: inspect unexpected values before changing them.
SELECT 'agents' AS source, status AS value, count(*) FROM public.agents GROUP BY status
UNION ALL SELECT 'pairing', status, count(*) FROM public.agent_pairing_sessions GROUP BY status
UNION ALL SELECT 'payment', payment_status, count(*) FROM public.print_orders GROUP BY payment_status;
