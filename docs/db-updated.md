Below is a **Phase 1 to Phase 13 full checks + tests checklist** for PrintEase.

Use this as your master verification plan.

---

# Master rule

After every phase:

```bash
node --check backend/src/db/schemaRunner.js
npm test --prefix backend
```

If backend code changed, also run:

```bash
node --check <changed-file>
```

If Supabase SQL changed, run:

```sql
SELECT 'DB_OK' AS result;
```

If Render deploy is involved, confirm:

```text
Build successful
Backend started
/api/health returns success
```

---

# Phase 1 — Fix `schema_migrations`

## Goal

Fix Render crash:

```text
relation "schema_migrations" does not exist
```

## Required DB check

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'schema_migrations';
```

Expected:

```text
schema_migrations
```

## Required backend check

```bash
node --check backend/src/db/schemaRunner.js
npm test --prefix backend
```

## Render test

After push, Render logs should show:

```text
[DB MIGRATION TABLE READY]
Backend running on port 5000
```

Should **not** show:

```text
relation "schema_migrations" does not exist
```

---

# Phase 2 — Core indexes + active print-job guard

## Goal

Improve DB performance and prevent duplicate active print jobs.

## Supabase index check

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_print_orders_user_id',
    'idx_print_orders_hub_id',
    'idx_print_orders_payment_status',
    'idx_print_orders_status',
    'idx_print_orders_guest_token',
    'idx_print_orders_expires_at',
    'idx_print_order_files_order_id',
    'idx_print_order_files_document_id',
    'idx_print_jobs_order_id',
    'idx_print_jobs_agent_status',
    'idx_print_jobs_hub_status',
    'idx_print_job_events_print_job_id',
    'idx_documents_user_id',
    'idx_document_access_logs_document_id',
    'idx_payments_order_id',
    'idx_agents_hub_id',
    'idx_agent_tokens_agent_id',
    'idx_agent_printers_agent_id',
    'idx_agent_printers_hub_id',
    'uniq_active_print_job_per_order'
  )
ORDER BY indexname;
```

Expected: all or most of these indexes should appear.

Most important:

```text
uniq_active_print_job_per_order
```

## Duplicate active print-job audit

```sql
SELECT order_id, COUNT(*) AS active_job_count
FROM print_jobs
WHERE status IN ('queued', 'accepted', 'downloading', 'printing')
GROUP BY order_id
HAVING COUNT(*) > 1;
```

Expected:

```text
0 rows
```

## Backend check

```bash
npm test --prefix backend
```

---

# Phase 3 — Guest token hash columns

## Goal

Prepare secure guest upload/order flow.

## Supabase column check

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'print_orders' AND column_name = 'guest_token_hash')
    OR (table_name = 'documents' AND column_name IN ('guest_token_hash', 'expires_at'))
  )
ORDER BY table_name, column_name;
```

Expected:

```text
documents      expires_at
documents      guest_token_hash
print_orders   guest_token_hash
```

## Index check

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_print_orders_guest_token_hash',
    'idx_documents_guest_token_hash',
    'idx_documents_expires_at'
  )
ORDER BY indexname;
```

Expected:

```text
idx_documents_expires_at
idx_documents_guest_token_hash
idx_print_orders_guest_token_hash
```

## Backend check

If only DB changed:

```bash
npm test --prefix backend
```

If guest backend service added:

```bash
node --check backend/src/services/guestAccessService.js
node --check backend/src/controllers/uploadController.js
node --check backend/src/controllers/orderController.js
npm test --prefix backend
```

---

# Phase 4 — DB audit before constraints

## Goal

Find bad old data before validating strict rules.

## Status audit

```sql
SELECT 'users.role' AS field, role AS value, COUNT(*) FROM users GROUP BY role
UNION ALL
SELECT 'print_orders.payment_status', payment_status, COUNT(*) FROM print_orders GROUP BY payment_status
UNION ALL
SELECT 'print_orders.status', status, COUNT(*) FROM print_orders GROUP BY status
UNION ALL
SELECT 'print_orders.customer_type', customer_type, COUNT(*) FROM print_orders GROUP BY customer_type
UNION ALL
SELECT 'agents.status', status, COUNT(*) FROM agents GROUP BY status
UNION ALL
SELECT 'agent_pairing_sessions.status', status, COUNT(*) FROM agent_pairing_sessions GROUP BY status
UNION ALL
SELECT 'print_jobs.status', status, COUNT(*) FROM print_jobs GROUP BY status
UNION ALL
SELECT 'agent_printers.status', status, COUNT(*) FROM agent_printers GROUP BY status
ORDER BY field, count DESC;
```

## Orphan audit

```sql
SELECT 'orphan_print_order_files_missing_order' AS audit_name, COUNT(*) AS bad_count
FROM print_order_files pof
LEFT JOIN print_orders po ON po.id = pof.order_id
WHERE po.id IS NULL;

SELECT 'orphan_print_order_files_missing_document' AS audit_name, COUNT(*) AS bad_count
FROM print_order_files pof
LEFT JOIN documents d ON d.id = pof.document_id
WHERE d.id IS NULL;

SELECT 'orphan_payments_missing_order' AS audit_name, COUNT(*) AS bad_count
FROM payments p
LEFT JOIN print_orders po ON po.id = p.order_id
WHERE p.order_id IS NOT NULL
  AND po.id IS NULL;

SELECT 'orphan_print_jobs_missing_order' AS audit_name, COUNT(*) AS bad_count
FROM print_jobs pj
LEFT JOIN print_orders po ON po.id = pj.order_id
WHERE po.id IS NULL;

SELECT 'documents_missing_storage_path' AS audit_name, COUNT(*) AS bad_count
FROM documents
WHERE storage_path IS NULL;
```

Expected:

```text
bad_count = 0
```

If `bad_count > 0`, do **not delete data immediately**. First inspect rows.

---

# Phase 5 — Foreign keys as `NOT VALID`

## Goal

Prevent new orphan records without breaking old data.

## Constraint check

```sql
SELECT
  conrelid::regclass::text AS table_name,
  conname,
  contype,
  convalidated
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname LIKE '%_fkey'
ORDER BY table_name, conname;
```

Expected:

```text
fkey constraints exist
convalidated may be false
```

`false` is okay for now.

## Important FK checks

You should see constraints for:

```text
documents_user_id_fkey
print_orders_user_id_fkey
print_orders_hub_id_fkey
payments_order_id_fkey
print_jobs_order_id_fkey
print_order_files_order_id_fkey
print_order_files_document_id_fkey
```

## Backend check

```bash
npm test --prefix backend
```

---

# Phase 6 — Status/default/check constraints

## Goal

Block bad future status values.

## Defaults check

```sql
SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'print_orders' AND column_name IN ('payment_status', 'customer_type'))
    OR (table_name = 'agents' AND column_name = 'paused')
    OR (table_name = 'agent_printers' AND column_name IN ('is_default', 'status'))
  )
ORDER BY table_name, column_name;
```

Expected examples:

```text
print_orders.payment_status default 'draft'
print_orders.customer_type default 'registered'
agents.paused default false
agent_printers.is_default default false
```

## Check constraint list

```sql
SELECT
  conrelid::regclass::text AS table_name,
  conname,
  contype,
  convalidated
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname LIKE '%_check'
ORDER BY table_name, conname;
```

Expected: check constraints exist.

`convalidated = false` is okay.

## Status insert/update risk test

Do **not** run destructive inserts. Instead check actual values:

```sql
SELECT 'agents.status' AS field, status AS value, COUNT(*) FROM agents GROUP BY status
UNION ALL
SELECT 'print_jobs.status', status, COUNT(*) FROM print_jobs GROUP BY status
UNION ALL
SELECT 'print_orders.payment_status', payment_status, COUNT(*) FROM print_orders GROUP BY payment_status
UNION ALL
SELECT 'print_orders.status', status, COUNT(*) FROM print_orders GROUP BY status
ORDER BY field, count DESC;
```

If you see values not allowed by constraints, widen the constraint. Do not delete rows.

---

# Phase 7 — `print_job_files` preparation

## Goal

Prepare per-file print execution tracking.

## Table check

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'print_job_files';
```

Expected:

```text
print_job_files
```

## Column check

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'print_job_files'
ORDER BY ordinal_position;
```

Expected important columns:

```text
id
print_job_id
order_file_id
document_id
status
file_sha256
file_type
copies
print_options
print_sequence
failure_reason_code
failure_reason_text
created_at
accepted_at
printing_started_at
completed_at
failed_at
```

## Index check

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_print_job_files%'
ORDER BY indexname;
```

Expected:

```text
idx_print_job_files_print_job_id
idx_print_job_files_order_file_id
idx_print_job_files_document_id
idx_print_job_files_status
idx_print_job_files_print_sequence
```

---

# Phase 8 — Validate constraints only after audit

## Goal

Move `NOT VALID` constraints to fully validated only when old data is clean.

## Check unvalidated constraints

```sql
SELECT
  conname,
  conrelid::regclass::text AS table_name,
  contype,
  convalidated
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND convalidated = false
ORDER BY table_name, conname;
```

## Safe validation candidates

Only validate these first if audit is clean:

```sql
ALTER TABLE documents VALIDATE CONSTRAINT documents_user_id_fkey;

ALTER TABLE print_job_files VALIDATE CONSTRAINT print_job_files_copies_check;
ALTER TABLE print_job_files VALIDATE CONSTRAINT print_job_files_print_sequence_check;
ALTER TABLE print_job_files VALIDATE CONSTRAINT print_job_files_status_check;
```

## Do not validate yet

Wait before validating:

```text
agents_status_check
agent_printers_status_check
agent_pairing_sessions_status_check
print_orders_status_check
print_orders_payment_status_check
print_jobs_status_check
```

Validate those only after backend status constants are aligned.

---

# Phase 9 — Backend guest token integration

## Goal

Use `guest_token_hash` in backend code.

## Code checks

```bash
node --check backend/src/services/guestAccessService.js
node --check backend/src/controllers/uploadController.js
node --check backend/src/controllers/orderController.js
npm test --prefix backend
```

## Manual API tests

### Guest upload

Expected:

```text
Guest upload succeeds.
Response includes guest token or existing guest token mechanism.
documents.guest_token_hash is stored.
documents.expires_at is stored.
```

DB check:

```sql
SELECT id, user_id, guest_token_hash, expires_at, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 5;
```

For guest document:

```text
user_id = null
guest_token_hash not null
expires_at not null
```

### Guest order with same token

Expected:

```text
<= 5 printable pages allowed
> 5 printable pages blocked
wrong token blocked
missing token blocked for guest document
```

DB check:

```sql
SELECT id, order_code, user_id, customer_type, guest_token_hash, expires_at, printable_page_count, payment_status
FROM print_orders
ORDER BY created_at DESC
LIMIT 5;
```

Expected for guest order:

```text
customer_type = guest
guest_token_hash not null
expires_at not null
```

---

# Phase 10 — Backend `print_job_files` integration

## Goal

When a print job is created, create per-file execution rows.

## Code checks

```bash
node --check backend/src/services/printQueue/printJobFilesService.js
node --check backend/src/services/printQueueService.js
npm test --prefix backend
```

If your service is at a different path, check that path.

## Manual DB test after creating/queueing an order

```sql
SELECT *
FROM print_jobs
ORDER BY created_at DESC
LIMIT 5;
```

Get latest `print_jobs.id`, then:

```sql
SELECT *
FROM print_job_files
WHERE print_job_id = '<PRINT_JOB_ID>'
ORDER BY print_sequence;
```

Expected:

```text
One print_job_files row per print_order_files row.
```

## Compatibility check

Legacy fields should still exist:

```sql
SELECT id, file_url, file_sha256, copies, print_options
FROM print_jobs
ORDER BY created_at DESC
LIMIT 5;
```

Do not remove these yet.

---

# Phase 11 — Backend status constants + DB alignment

## Goal

Avoid constraint errors from inconsistent status strings.

## Search checks

Run locally:

```bash
grep -R "payment_status\|status.*=\|status:" backend/src --include="*.js"
```

Better targeted:

```bash
grep -R "'queued'\|'accepted'\|'downloading'\|'printing'\|'completed'\|'failed'\|'cancelled'\|'active'\|'offline'\|'pending'\|'collected'\|'verified'\|'draft'" backend/src --include="*.js"
```

## Code checks

```bash
node --check backend/src/constants/statuses.js
node --check backend/src/services/printQueueService.js
node --check backend/src/controllers/agentController.js
node --check backend/src/controllers/hubAgentController.js
node --check backend/src/services/manualCollectionService.js
npm test --prefix backend
```

## DB compatibility check

Run after code review:

```sql
SELECT 'agents.status' AS field, status AS value, COUNT(*) FROM agents GROUP BY status
UNION ALL
SELECT 'print_jobs.status', status, COUNT(*) FROM print_jobs GROUP BY status
UNION ALL
SELECT 'print_orders.payment_status', payment_status, COUNT(*) FROM print_orders GROUP BY payment_status
UNION ALL
SELECT 'print_orders.status', status, COUNT(*) FROM print_orders GROUP BY status
ORDER BY field, count DESC;
```

Expected:

```text
All values are included in DB CHECK constraints.
```

---

# Phase 12 — Full guest order lifecycle tests

## Goal

Guest upload/order/limit works safely.

## Backend checks

```bash
node --check backend/src/services/guestAccessService.js
node --check backend/src/services/guestPrintLimitService.js
node --check backend/src/services/orderDocumentAccessService.js
node --check backend/src/controllers/uploadController.js
node --check backend/src/controllers/orderController.js
npm test --prefix backend
```

## Manual test cases

### Test 1: guest upload

```text
Upload PDF without login.
Expected:
- success true
- document created
- user_id null
- guest_token_hash stored
- expires_at stored
```

DB:

```sql
SELECT id, user_id, file_name, guest_token_hash, expires_at, page_count
FROM documents
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 2: guest order <= 5 pages

```text
Guest creates order for 5 printable pages or less.
Expected:
- order created
- customer_type guest
- guest_token_hash stored
- payment_status draft/pending depending app flow
```

DB:

```sql
SELECT order_code, customer_type, guest_token_hash, expires_at, printable_page_count, payment_status
FROM print_orders
ORDER BY created_at DESC
LIMIT 5;
```

---

### Test 3: guest order > 5 pages

Expected response:

```json
{
  "success": false,
  "code": "LOGIN_REQUIRED_FOR_MORE_THAN_5_PAGES"
}
```

---

### Test 4: wrong guest token

Expected:

```text
403 forbidden
document cannot be used
```

---

### Test 5: logged-in user > 5 pages

Expected:

```text
allowed
```

---

# Phase 13 — Desktop/backend multi-file contract

## Goal

Desktop processes all files in `job.files[]`.

## Backend checks

```bash
node --check backend/src/controllers/agentController.js
node --check backend/src/services/agentPayload/agentJobPayloadService.js
npm test --prefix backend
```

If `agentJobPayloadService.js` does not exist yet, check current agent controller only.

## Desktop checks

```bash
node --check desktop-shell/agent/jobFiles.js
node --check desktop-shell/agent/jobPoller.js
node --check desktop-shell/printer/printExecutor.js
```

## Agent payload DB/API test

Create/queue a multi-file order, then inspect payload from agent endpoint or backend logs.

Expected payload shape:

```json
{
  "jobId": "...",
  "orderId": "...",
  "files": [
    {
      "documentId": "...",
      "fileUrl": "...",
      "fileSha256": "...",
      "fileName": "...",
      "copies": 1,
      "printOptions": {},
      "printSequence": 0
    }
  ]
}
```

## Desktop behavior tests

### Test 1: legacy single-file job

Expected:

```text
Still works using job.fileUrl fallback.
```

### Test 2: multi-file job

Expected:

```text
Desktop prints/submits every file in job.files[] sequentially.
```

### Test 3: hash mismatch

Expected:

```text
Desktop blocks print.
Job marked failed.
No remaining files printed.
```

### Test 4: missing fileUrl

Expected:

```text
Job failed with clear reason.
```

### Test 5: first file fails

Expected:

```text
Stop remaining files.
Whole job failed.
```

---

# Render deployment final check

After backend phases:

```text
Render build successful
npm install successful
npm start successful
[DB CHECK STARTED]
[DB SCHEMA APPLIED]
[DB MIGRATION TABLE READY]
Backend running on port 5000
```

Check endpoint:

```bash
curl https://printease-backend-byex.onrender.com/api/health
```

Expected:

```json
{
  "success": true
}
```

---

# Supabase final health check

Run this one at the end:

```sql
SELECT 'schema_migrations_exists' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'schema_migrations'
       ) AS ok;

SELECT 'print_job_files_exists' AS check_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'print_job_files'
       ) AS ok;

SELECT 'duplicate_active_print_jobs' AS check_name,
       COUNT(*) AS bad_count
FROM (
  SELECT order_id
  FROM print_jobs
  WHERE status IN ('queued', 'accepted', 'downloading', 'printing')
  GROUP BY order_id
  HAVING COUNT(*) > 1
) x;

SELECT 'orphan_print_jobs' AS check_name,
       COUNT(*) AS bad_count
FROM print_jobs pj
LEFT JOIN print_orders po ON po.id = pj.order_id
WHERE po.id IS NULL;

SELECT 'orphan_order_files' AS check_name,
       COUNT(*) AS bad_count
FROM print_order_files pof
LEFT JOIN print_orders po ON po.id = pof.order_id
WHERE po.id IS NULL;
```

Expected:

```text
ok = true
bad_count = 0
```

---

# What not to do during Phase 1–13

```text
Do not delete Supabase database.
Do not drop old columns.
Do not make storage bucket public.
Do not remove print_jobs.file_url yet.
Do not remove print_orders.document_url/pages/copies yet.
Do not validate all NOT VALID constraints before audit.
Do not mix desktop hardening with backend DB migration in one commit.
Do not refactor createOrder fully while testing guest/security phases.
```

---

# Best commit order

Use small commits:

```text
1. fix: create schema migrations table before migrations
2. db: add core indexes and print job guard
3. db: add guest token hash columns
4. db: add audit queries
5. db: add safe foreign keys not valid
6. db: add safe status constraints not valid
7. db: prepare print job files table
8. backend: add status constants
9. backend: implement guest access service
10. backend: populate print job files
11. desktop: process job files array
```

That is the safest way to finish Phase 1–13.
