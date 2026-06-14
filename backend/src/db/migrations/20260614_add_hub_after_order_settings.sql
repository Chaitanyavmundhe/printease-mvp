alter table print_hubs add column if not exists after_order_settings jsonb not null default '{}'::jsonb;
