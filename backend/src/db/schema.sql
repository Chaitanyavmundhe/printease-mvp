create extension if not exists "pgcrypto";

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  mobile text not null unique,
  password_hash text not null,
  role text not null check (role in ('user', 'hub', 'admin')),
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'users_role_check'
  ) then
    alter table users drop constraint users_role_check;
  end if;

  update users
  set role = 'hub'
  where role not in ('user', 'hub', 'admin');

  alter table users
    add constraint users_role_check
    check (role in ('user', 'hub', 'admin'));
end $$;

create table if not exists print_hubs (
  id text primary key default gen_random_uuid()::text,
  owner_id text references users(id) on delete cascade,
  hub_name text not null,
  centre_code text not null unique,
  mobile text not null,
  status text not null default 'available',
  upi_id text,
  bw_single numeric(10, 2) not null default 1,
  bw_double numeric(10, 2) not null default 1.5,
  color_single numeric(10, 2) not null default 2,
  color_double numeric(10, 2) not null default 3,
  watermark_charge numeric(10, 2) not null default 2,
  created_at timestamptz not null default now()
);

alter table print_hubs add column if not exists bw_single numeric(10, 2) not null default 1;
alter table print_hubs add column if not exists bw_double numeric(10, 2) not null default 1.5;
alter table print_hubs add column if not exists color_single numeric(10, 2) not null default 2;
alter table print_hubs add column if not exists color_double numeric(10, 2) not null default 3;
alter table print_hubs add column if not exists watermark_charge numeric(10, 2) not null default 2;

do $$
begin
  if to_regclass('public.centres') is not null then
    insert into print_hubs (
      id,
      owner_id,
      hub_name,
      centre_code,
      mobile,
      status,
      upi_id,
      bw_single,
      bw_double,
      color_single,
      color_double,
      watermark_charge,
      created_at
    )
    select
      c.id,
      case when u.id is null then null else c.owner_id end,
      c.name,
      c.centre_code,
      c.mobile,
      c.status,
      c.upi_id,
      c.bw_single,
      c.bw_double,
      c.color_single,
      c.color_double,
      c.watermark_charge,
      c.created_at
    from centres c
    left join users u on u.id = c.owner_id
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists documents (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size integer,
  file_url text not null,
  file_sha256 text,
  storage_path text,
  page_count integer,
  created_at timestamptz not null default now()
);

alter table documents add column if not exists file_sha256 text;
alter table documents add column if not exists storage_path text;
alter table documents add column if not exists page_count integer;

create table if not exists print_orders (
  id text primary key default gen_random_uuid()::text,
  order_code text not null unique,
  user_id text references users(id) on delete set null,
  hub_id text not null references print_hubs(id) on delete cascade,
  document_name text not null,
  document_url text,
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

do $$
begin
  if to_regclass('public.orders') is not null then
    insert into print_orders (
      id,
      order_code,
      user_id,
      hub_id,
      document_name,
      document_url,
      pages,
      copies,
      color_type,
      side_type,
      watermark_enabled,
      amount,
      payment_status,
      status,
      pickup_code,
      created_at
    )
    select
      o.id,
      o.order_code,
      case when u.id is null then null else o.user_id end,
      o.centre_id,
      o.document_name,
      o.document_id,
      o.pages,
      o.copies,
      o.color_type,
      o.side_type,
      o.watermark_enabled,
      o.amount,
      o.payment_status,
      o.status,
      o.pickup_code,
      o.created_at
    from orders o
    join print_hubs h on h.id = o.centre_id
    left join users u on u.id = o.user_id
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists payments (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references print_orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text,
  transaction_id text,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table payments add column if not exists method text;
alter table payments add column if not exists transaction_id text;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments'
      and column_name = 'gateway'
  ) then
    alter table payments alter column gateway drop not null;

    update payments
    set
      method = coalesce(method, gateway),
      transaction_id = coalesce(transaction_id, gateway_payment_id, gateway_order_id);
  end if;
end $$;

create table if not exists printers (
  id text primary key default gen_random_uuid()::text,
  hub_id text references print_hubs(id) on delete cascade,
  printer_name text not null,
  printer_type text not null default 'laser',
  protocol text not null default 'PDF_MANUAL_DOWNLOAD',
  ip_address text not null default '',
  port integer,
  status text not null default 'offline',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table printers add column if not exists hub_id text references print_hubs(id) on delete cascade;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'printers'
      and column_name = 'centre_id'
  ) then
    alter table printers alter column centre_id drop not null;

    update printers
    set hub_id = coalesce(hub_id, centre_id);
  end if;
end $$;

create table if not exists agents (
  id text primary key default gen_random_uuid()::text,
  hub_id text not null references print_hubs(id) on delete cascade,
  agent_name text not null,
  device_id text not null,
  platform text,
  version text,
  status text not null default 'offline',
  paused boolean not null default false,
  last_seen_at timestamptz,
  paired_at timestamptz default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(device_id)
);

create table if not exists agent_tokens (
  id text primary key default gen_random_uuid()::text,
  agent_id text not null references agents(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists agent_pairing_sessions (
  id text primary key default gen_random_uuid()::text,
  pairing_code_hash text not null,
  device_id text not null,
  agent_name text not null,
  platform text,
  version text,
  status text not null default 'pending',
  hub_id text references print_hubs(id) on delete cascade,
  agent_id text references agents(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create table if not exists agent_printers (
  id text primary key default gen_random_uuid()::text,
  agent_id text not null references agents(id) on delete cascade,
  hub_id text not null references print_hubs(id) on delete cascade,
  printer_name text not null,
  system_printer_id text,
  status text not null default 'unknown',
  is_default boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references print_orders(id) on delete cascade,
  hub_id text not null references print_hubs(id) on delete cascade,
  agent_id text references agents(id) on delete set null,
  printer_name text,
  status text not null default 'queued',
  file_url text not null,
  file_sha256 text,
  file_type text not null default 'application/pdf',
  copies integer not null default 1,
  paper_size text not null default 'A4',
  color_mode text not null default 'bw',
  source_backend_url text not null default 'https://printease-backend-byex.onrender.com',
  failure_reason_code text,
  failure_reason_text text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  printing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
);

create table if not exists print_job_events (
  id text primary key default gen_random_uuid()::text,
  print_job_id text not null references print_jobs(id) on delete cascade,
  agent_id text references agents(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  message text,
  raw_status jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_print_orders_user_id on print_orders(user_id);
create index if not exists idx_print_orders_hub_id on print_orders(hub_id);
create index if not exists idx_payments_order_id on payments(order_id);
create index if not exists idx_printers_hub_id on printers(hub_id);
create index if not exists idx_agents_hub_id on agents(hub_id);
create index if not exists idx_agent_tokens_agent_id on agent_tokens(agent_id);
create index if not exists idx_pairing_sessions_device_id on agent_pairing_sessions(device_id);
create index if not exists idx_print_jobs_hub_id on print_jobs(hub_id);
create index if not exists idx_print_jobs_agent_id on print_jobs(agent_id);
create index if not exists idx_print_jobs_order_id on print_jobs(order_id);
