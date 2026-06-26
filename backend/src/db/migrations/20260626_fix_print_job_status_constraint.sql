-- Keep the database status constraint aligned with the backend print agent state machine.
-- The desktop poller claims queued jobs by moving them to `assigned`, and newer
-- printer executors can report `submitted_to_printer` before completion.

ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;

ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check CHECK (
  status IN (
    'queued',
    'assigned',
    'accepted',
    'downloading',
    'printing',
    'submitted_to_printer',
    'completed',
    'failed',
    'cancelled'
  )
);
