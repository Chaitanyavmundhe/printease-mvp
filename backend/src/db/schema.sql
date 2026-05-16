create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null unique,
  password_hash text not null,
  role text not null check (role in ('user', 'centre')),
  hub_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists print_hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references users(id) on delete cascade,
  centre_code text not null unique,
  mobile text not null,
  status text not null default 'available',
  upi_id text not null default '',
  bw_single numeric(10, 2) not null default 1,
  bw_double numeric(10, 2) not null default 1.5,
  color_single numeric(10, 2) not null default 2,
  color_double numeric(10, 2) not null default 3,
  watermark_charge numeric(10, 2) not null default 2,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_hub_id_fkey'
  ) then
    alter table users
      add constraint users_hub_id_fkey
      foreign key (hub_id)
      references print_hubs(id)
      on delete set null;
  end if;
end $$;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size integer,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists print_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid references users(id) on delete set null,
  hub_id uuid not null references print_hubs(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  document_name text not null,
  pages integer not null,
  copies integer not null,
  color_type text not null default 'bw',
  side_type text not null default 'single',
  watermark_enabled boolean not null default false,
  amount numeric(10, 2) not null,
  payment_status text not null default 'pending',
  status text not null default 'Payment Pending',
  pickup_code text not null,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references print_orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  gateway text not null default 'DEMO_UPI',
  gateway_order_id text,
  gateway_payment_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists printers (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references print_hubs(id) on delete cascade,
  printer_name text not null,
  printer_type text not null default 'laser',
  protocol text not null default 'PDF_MANUAL_DOWNLOAD',
  ip_address text not null default '',
  port integer,
  status text not null default 'offline',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_hub_id on users(hub_id);
create index if not exists idx_print_orders_user_id on print_orders(user_id);
create index if not exists idx_print_orders_hub_id on print_orders(hub_id);
create index if not exists idx_payments_order_id on payments(order_id);
create index if not exists idx_printers_hub_id on printers(hub_id);
