ALTER TABLE documents
ADD COLUMN IF NOT EXISTS print_ready_storage_path text,
ADD COLUMN IF NOT EXISTS print_ready_sha256 text,
ADD COLUMN IF NOT EXISTS conversion_source text,
ADD COLUMN IF NOT EXISTS conversion_placement text,
ADD COLUMN IF NOT EXISTS conversion_reason_code text,
ADD COLUMN IF NOT EXISTS file_kind text,
ADD COLUMN IF NOT EXISTS requires_desktop_preparation boolean default false;
