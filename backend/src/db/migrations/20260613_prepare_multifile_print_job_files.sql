CREATE TABLE IF NOT EXISTS print_job_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id text NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  order_file_id text REFERENCES print_order_files(id) ON DELETE SET NULL,
  document_id text REFERENCES documents(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  file_sha256 text,
  file_type text NOT NULL DEFAULT 'application/pdf',
  copies int4 NOT NULL DEFAULT 1,
  print_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  print_sequence int4 NOT NULL DEFAULT 0,
  failure_reason_code text,
  failure_reason_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  printing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_print_job_files_print_job_id ON print_job_files(print_job_id);
CREATE INDEX IF NOT EXISTS idx_print_job_files_order_file_id ON print_job_files(order_file_id);
CREATE INDEX IF NOT EXISTS idx_print_job_files_document_id ON print_job_files(document_id);
CREATE INDEX IF NOT EXISTS idx_print_job_files_status ON print_job_files(status);
