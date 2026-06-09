alter table print_hubs add column if not exists location_enabled boolean not null default false;
alter table print_hubs add column if not exists latitude numeric(10,7);
alter table print_hubs add column if not exists longitude numeric(10,7);
alter table print_hubs add column if not exists address_text text;
alter table print_hubs add column if not exists area text;
alter table print_hubs add column if not exists city text;
alter table print_hubs add column if not exists map_updated_at timestamptz;

create index if not exists idx_print_hubs_location_enabled on print_hubs(location_enabled) where location_enabled = true;
