-- Migration: align referencing order_id column types with print_orders.id
-- Safe checks: will abort if non-convertible values exist.

DO $$
DECLARE
  ref_type text;
  cur_type text;
  bad_count bigint;
BEGIN
  -- detect referenced type for print_orders.id
  SELECT udt_name INTO ref_type
  FROM information_schema.columns
  WHERE table_name = 'print_orders' AND column_name = 'id'
  LIMIT 1;

  IF ref_type IS NULL THEN
    RAISE NOTICE 'print_orders.id not found; skipping migration.';
    RETURN;
  END IF;

  -- Helper: update a column on a table to ref_type if types differ
  -- Tables to process: print_order_files, document_access_logs, payments, print_jobs

  -- print_order_files.order_id
  SELECT udt_name INTO cur_type FROM information_schema.columns WHERE table_name = 'print_order_files' AND column_name = 'order_id' LIMIT 1;
  IF cur_type IS NOT NULL AND cur_type <> ref_type THEN
    IF ref_type = 'uuid' THEN
      EXECUTE $sql$SELECT count(*) FROM print_order_files WHERE order_id IS NOT NULL AND order_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'$sql$ INTO bad_count;
      IF bad_count > 0 THEN
        RAISE EXCEPTION 'migration aborted: print_order_files.order_id contains % non-UUID values', bad_count;
      END IF;
    END IF;
    ALTER TABLE print_order_files DROP CONSTRAINT IF EXISTS print_order_files_order_id_fkey;
    IF ref_type = 'uuid' THEN
      ALTER TABLE print_order_files ALTER COLUMN order_id TYPE uuid USING order_id::uuid;
    ELSE
      ALTER TABLE print_order_files ALTER COLUMN order_id TYPE text USING order_id::text;
    END IF;
    ALTER TABLE print_order_files ADD CONSTRAINT print_order_files_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'print_order_files.order_id converted from % to %', cur_type, ref_type;
  END IF;

  -- document_access_logs.order_id
  SELECT udt_name INTO cur_type FROM information_schema.columns WHERE table_name = 'document_access_logs' AND column_name = 'order_id' LIMIT 1;
  IF cur_type IS NOT NULL AND cur_type <> ref_type THEN
    IF ref_type = 'uuid' THEN
      EXECUTE $sql$SELECT count(*) FROM document_access_logs WHERE order_id IS NOT NULL AND order_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'$sql$ INTO bad_count;
      IF bad_count > 0 THEN
        RAISE EXCEPTION 'migration aborted: document_access_logs.order_id contains % non-UUID values', bad_count;
      END IF;
    END IF;
    ALTER TABLE document_access_logs DROP CONSTRAINT IF EXISTS document_access_logs_order_id_fkey;
    IF ref_type = 'uuid' THEN
      ALTER TABLE document_access_logs ALTER COLUMN order_id TYPE uuid USING order_id::uuid;
    ELSE
      ALTER TABLE document_access_logs ALTER COLUMN order_id TYPE text USING order_id::text;
    END IF;
    ALTER TABLE document_access_logs ADD CONSTRAINT document_access_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'document_access_logs.order_id converted from % to %', cur_type, ref_type;
  END IF;

  -- payments.order_id
  SELECT udt_name INTO cur_type FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'order_id' LIMIT 1;
  IF cur_type IS NOT NULL AND cur_type <> ref_type THEN
    IF ref_type = 'uuid' THEN
      EXECUTE $sql$SELECT count(*) FROM payments WHERE order_id IS NOT NULL AND order_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'$sql$ INTO bad_count;
      IF bad_count > 0 THEN
        RAISE EXCEPTION 'migration aborted: payments.order_id contains % non-UUID values', bad_count;
      END IF;
    END IF;
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
    IF ref_type = 'uuid' THEN
      ALTER TABLE payments ALTER COLUMN order_id TYPE uuid USING order_id::uuid;
    ELSE
      ALTER TABLE payments ALTER COLUMN order_id TYPE text USING order_id::text;
    END IF;
    ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'payments.order_id converted from % to %', cur_type, ref_type;
  END IF;

  -- print_jobs.order_id
  SELECT udt_name INTO cur_type FROM information_schema.columns WHERE table_name = 'print_jobs' AND column_name = 'order_id' LIMIT 1;
  IF cur_type IS NOT NULL AND cur_type <> ref_type THEN
    IF ref_type = 'uuid' THEN
      EXECUTE $sql$SELECT count(*) FROM print_jobs WHERE order_id IS NOT NULL AND order_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'$sql$ INTO bad_count;
      IF bad_count > 0 THEN
        RAISE EXCEPTION 'migration aborted: print_jobs.order_id contains % non-UUID values', bad_count;
      END IF;
    END IF;
    ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_order_id_fkey;
    IF ref_type = 'uuid' THEN
      ALTER TABLE print_jobs ALTER COLUMN order_id TYPE uuid USING order_id::uuid;
    ELSE
      ALTER TABLE print_jobs ALTER COLUMN order_id TYPE text USING order_id::text;
    END IF;
    ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE;
    RAISE NOTICE 'print_jobs.order_id converted from % to %', cur_type, ref_type;
  END IF;

END$$;
