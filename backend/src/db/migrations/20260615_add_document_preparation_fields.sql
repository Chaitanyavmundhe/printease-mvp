-- Add document preparation fields
alter table documents add column if not exists prepared_page_count integer;
alter table documents add column if not exists preparation_status text default 'prepared';
alter table documents add column if not exists preparation_error_code text;
alter table documents add column if not exists preparation_error_message text;
alter table documents add column if not exists prepared_at timestamptz;

-- Set default values for existing non-pending documents
update documents 
set preparation_status = 'prepared' 
where preparation_status is null;

-- Ensure check constraint safely
DO $$
BEGIN
  ALTER TABLE documents ADD CONSTRAINT documents_preparation_status_check CHECK (
    preparation_status IN ('pending', 'prepared', 'failed')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
