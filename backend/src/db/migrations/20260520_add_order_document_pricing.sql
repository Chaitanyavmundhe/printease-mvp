alter table documents add column if not exists file_type text;
alter table documents add column if not exists file_size_bytes bigint;
alter table documents add column if not exists storage_path text;
alter table documents add column if not exists file_sha256 text;
alter table documents add column if not exists page_count integer;
alter table print_orders add column if not exists total_amount_paise integer;
alter table payments add column if not exists razorpay_order_id text;
alter table payments add column if not exists razorpay_payment_id text;
alter table payments add column if not exists razorpay_signature text;
alter table payments add column if not exists payment_link_id text;
alter table payments add column if not exists qr_id text;
alter table payments add column if not exists raw_response jsonb;

update print_orders
set total_amount_paise = round(amount * 100)::integer
where total_amount_paise is null and amount is not null;

update documents
set file_size_bytes = file_size
where file_size_bytes is null and file_size is not null;

create table if not exists print_order_files (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references print_orders(id) on delete cascade,
  document_id text not null references documents(id) on delete restrict,
  original_page_count integer not null,
  selected_pages text not null default 'all',
  selected_page_count integer not null,
  printable_page_count integer not null,
  sheet_count integer not null,
  copies integer not null,
  print_options jsonb not null default '{}'::jsonb,
  line_amount_paise integer not null,
  print_sequence integer not null default 1,
  created_at timestamptz not null default now()
);

alter table print_order_files add column if not exists print_sequence integer not null default 1;

create index if not exists idx_print_order_files_order_id on print_order_files(order_id);
create index if not exists idx_print_order_files_document_id on print_order_files(document_id);

create table if not exists document_access_logs (
  id text primary key default gen_random_uuid()::text,
  document_id text not null references documents(id) on delete cascade,
  order_id text references print_orders(id) on delete cascade,
  user_id text references users(id) on delete set null,
  action text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_access_logs_document_id on document_access_logs(document_id);
create index if not exists idx_document_access_logs_user_id on document_access_logs(user_id);
create index if not exists idx_payments_razorpay_order_id on payments(razorpay_order_id);
create index if not exists idx_payments_razorpay_payment_id on payments(razorpay_payment_id);
