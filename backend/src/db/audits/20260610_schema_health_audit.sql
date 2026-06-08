-- Phase 4: Schema Health Audit
-- Run this manually in Supabase SQL Editor to check data consistency.
-- Do NOT add strict constraints until these return 0 invalid rows.

-- 1. Check invalid user roles
SELECT role, COUNT(*)
FROM users
GROUP BY role;

-- 2. Check print_orders payment statuses
SELECT payment_status, COUNT(*)
FROM print_orders
GROUP BY payment_status;

-- 3. Check order statuses
SELECT status, COUNT(*)
FROM print_orders
GROUP BY status;

-- 4. Check agent statuses
SELECT status, COUNT(*)
FROM agents
GROUP BY status;

-- 5. Check print job statuses
SELECT status, COUNT(*)
FROM print_jobs
GROUP BY status;

-- 6. Find order files pointing to missing orders
SELECT pof.*
FROM print_order_files pof
LEFT JOIN print_orders po ON po.id = pof.order_id
WHERE po.id IS NULL;

-- 7. Find order files pointing to missing documents
SELECT pof.*
FROM print_order_files pof
LEFT JOIN documents d ON d.id = pof.document_id
WHERE d.id IS NULL;

-- 8. Find payments pointing to missing orders
SELECT p.*
FROM payments p
LEFT JOIN print_orders po ON po.id = p.order_id
WHERE p.order_id IS NOT NULL AND po.id IS NULL;

-- 9. Find print jobs pointing to missing orders
SELECT pj.*
FROM print_jobs pj
LEFT JOIN print_orders po ON po.id = pj.order_id
WHERE po.id IS NULL;

-- 10. Find documents missing storage path
SELECT *
FROM documents
WHERE storage_path IS NULL;

-- 11. Find print_orders with customer_type outside expected values
SELECT customer_type, COUNT(*)
FROM print_orders
GROUP BY customer_type;

-- 12. Find guest orders with missing expires_at
SELECT *
FROM print_orders
WHERE user_id IS NULL AND expires_at IS NULL;

-- 13. Find guest documents with missing expires_at if guest_token_hash exists
SELECT *
FROM documents
WHERE user_id IS NULL AND guest_token_hash IS NOT NULL AND expires_at IS NULL;
