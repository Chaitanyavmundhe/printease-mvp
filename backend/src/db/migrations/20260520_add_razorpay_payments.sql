alter table payments add column if not exists provider text;
alter table payments add column if not exists provider_order_id text;
alter table payments add column if not exists provider_payment_id text;
alter table payments add column if not exists provider_signature text;
alter table payments add column if not exists provider_status text;
alter table payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table payments add column if not exists payment_link_id text;
alter table payments add column if not exists qr_code_id text;
alter table payments add column if not exists qr_image_url text;
alter table payments add column if not exists short_url text;

create index if not exists idx_payments_provider_order_id on payments(provider_order_id);
create index if not exists idx_payments_provider_payment_id on payments(provider_payment_id);
create index if not exists idx_payments_order_provider on payments(order_id, provider);
