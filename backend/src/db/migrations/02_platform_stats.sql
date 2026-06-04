create table if not exists platform_visits (
  session_id text primary key,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists idx_platform_visits_last_active on platform_visits(last_active_at);
