create table if not exists users (
  id text primary key,
  name text not null,
  mobile text not null unique,
  password_hash text not null,
  role text not null check (role in ('user', 'centre')),
  centre_id text,
  created_at timestamptz not null default now()
);

create table if not exists centres (
  id text primary key,
  name text not null,
  owner_id text references users(id) on delete set null,
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
    where conname = 'users_centre_id_fkey'
  ) then
    alter table users
      add constraint users_centre_id_fkey
      foreign key (centre_id)
      references centres(id)
      on delete set null;
  end if;
end $$;

create table if not exists documents (
  id text primary key,
  user_id text references users(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size integer,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  order_code text not null unique,
  user_id text references users(id) on delete set null,
  centre_id text not null references centres(id) on delete cascade,
  document_id text references documents(id) on delete set null,
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
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  gateway text not null default 'DEMO_UPI',
  gateway_order_id text,
  gateway_payment_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists printers (
  id text primary key,
  centre_id text not null references centres(id) on delete cascade,
  printer_name text not null,
  printer_type text not null default 'laser',
  protocol text not null default 'PDF_MANUAL_DOWNLOAD',
  ip_address text not null default '',
  port integer,
  status text not null default 'offline',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_centre_id on orders(centre_id);
create index if not exists idx_payments_order_id on payments(order_id);
create index if not exists idx_printers_centre_id on printers(centre_id);
