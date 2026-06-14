-- Add document preparation fields
alter table documents add column if not exists prepared_page_count integer;
alter table documents add column if not exists preparation_status text default 'prepared';
alter table documents add column if not exists preparation_error_code text;
alter table documents add column if not exists preparation_error_message text;
alter table documents add column if not exists prepared_at timestamptz;

alter table documents drop constraint if exists documents_preparation_status_check;

-- Normalize legacy/free-form values before adding the strict constraint.
-- Old deploys used values such as "not_prepared"; the live enum is only:
-- pending, prepared, failed.
update documents
set preparation_status = case
  when preparation_status in ('pending', 'prepared', 'failed') then preparation_status
  when page_count is not null and page_count > 0 then 'prepared'
  else 'pending'
end;

alter table documents alter column preparation_status set default 'prepared';

-- Ensure check constraint safely
alter table documents add constraint documents_preparation_status_check
  check (preparation_status in ('pending', 'prepared', 'failed'));
