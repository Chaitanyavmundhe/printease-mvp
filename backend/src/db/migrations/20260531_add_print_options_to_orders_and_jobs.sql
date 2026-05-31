alter table print_orders
  add column if not exists print_options jsonb not null default '{}'::jsonb,
  add column if not exists selected_page_count integer,
  add column if not exists printable_page_count integer,
  add column if not exists sheet_count integer;

alter table print_jobs
  add column if not exists print_options jsonb not null default '{}'::jsonb;
