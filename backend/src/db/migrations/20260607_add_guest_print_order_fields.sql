alter table print_orders add column if not exists customer_type text default 'registered';
alter table print_orders add column if not exists expires_at timestamp with time zone;
alter table print_orders add column if not exists guest_token text;
alter table print_orders add column if not exists guest_name text;
alter table print_orders add column if not exists guest_phone text;
alter table print_orders add column if not exists price_snapshot jsonb;
alter table print_orders add column if not exists print_config_snapshot jsonb;

create index if not exists idx_print_orders_guest_token
  on print_orders(guest_token)
  where guest_token is not null;

create index if not exists idx_print_orders_guest_cleanup
  on print_orders(customer_type, payment_status, expires_at)
  where customer_type = 'guest';
