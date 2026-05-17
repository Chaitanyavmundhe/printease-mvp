create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
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

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size integer,
  file_url text not null,
  file_sha256 text,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table documents add column if not exists file_sha256 text;
alter table documents add column if not exists storage_path text;

create table if not exists print_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid references users(id) on delete set null,
  hub_id uuid not null references print_hubs(id) on delete cascade,
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

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references print_orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  method text,
  transaction_id text,
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

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references print_hubs(id) on delete cascade,
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
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists agent_pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  pairing_code_hash text not null,
  device_id text not null,
  agent_name text not null,
  platform text,
  version text,
  status text not null default 'pending',
  hub_id uuid references print_hubs(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create table if not exists agent_printers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  hub_id uuid not null references print_hubs(id) on delete cascade,
  printer_name text not null,
  system_printer_id text,
  status text not null default 'unknown',
  is_default boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references print_orders(id) on delete cascade,
  hub_id uuid not null references print_hubs(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
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
  id uuid primary key default gen_random_uuid(),
  print_job_id uuid not null references print_jobs(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
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
