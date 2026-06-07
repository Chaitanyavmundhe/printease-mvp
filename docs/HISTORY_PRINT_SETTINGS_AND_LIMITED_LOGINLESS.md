# History Settings and Limited Login-less Print Flow

## Current behavior

- Logged-in users can print without the 5-page login-less limit.
- Logged-in users can open My Prints and see previous orders, documents, payments, and the print settings used.
- Login-less users can create a limited print order for up to 5 selected pages.
- Login-less orders do not appear in user history.
- Login-less order/payment access uses a short random `orderAccessToken` stored in `print_orders.guest_token`; do not replace this with public access.

## Important security rule

Never add an access check like:

```js
if (!order.userId) return true;
```

Anonymous/limited orders must require the matching token.

## Supabase SQL

Run this in Supabase SQL Editor if these columns/tables are missing:

```sql
alter table users add column if not exists email text;
alter table users add column if not exists username text;
alter table users add column if not exists display_handle text;
alter table users add column if not exists password_hash text;

alter table users alter column email drop not null;
alter table users alter column mobile drop not null;
alter table users alter column password_hash drop not null;

create unique index if not exists users_username_unique
  on users (lower(username))
  where username is not null;

create unique index if not exists users_email_unique
  on users (lower(email))
  where email is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_format_check'
  ) then
    alter table users
      add constraint users_username_format_check
      check (username is null or username ~ '^[a-z0-9]{3,32}$');
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'users_role_check'
  ) then
    alter table users drop constraint users_role_check;
  end if;

  alter table users
    add constraint users_role_check
    check (role in ('user', 'hub', 'admin'));
end $$;

alter table documents add column if not exists file_type text;
alter table documents add column if not exists file_size_bytes bigint;
alter table documents add column if not exists storage_path text;
alter table documents add column if not exists file_sha256 text;
alter table documents add column if not exists page_count integer;

alter table print_orders add column if not exists total_amount_paise integer;
alter table print_orders add column if not exists customer_type text default 'registered';
alter table print_orders add column if not exists expires_at timestamptz;
alter table print_orders add column if not exists guest_token text;
alter table print_orders add column if not exists guest_name text;
alter table print_orders add column if not exists guest_phone text;
alter table print_orders add column if not exists price_snapshot jsonb;
alter table print_orders add column if not exists print_config_snapshot jsonb;

create table if not exists print_order_files (
  id text primary key,
  order_id uuid references print_orders(id) on delete cascade,
  document_id text references documents(id) on delete set null,
  original_page_count integer,
  selected_pages text,
  selected_page_count integer,
  printable_page_count integer,
  sheet_count integer,
  copies integer not null default 1,
  print_options jsonb not null default '{}'::jsonb,
  line_amount_paise integer,
  amount_paise integer,
  print_sequence integer not null default 1,
  created_at timestamptz default now()
);

create index if not exists idx_print_order_files_order_id
  on print_order_files(order_id);

create index if not exists idx_print_order_files_document_id
  on print_order_files(document_id);

alter table print_hubs add column if not exists upi_qr_image_url text;
```

## History data source

The user history API reads:

- `print_orders.print_config_snapshot`
- `print_orders.price_snapshot`
- `print_order_files.print_options`
- `print_order_files.original_page_count`
- `print_order_files.selected_pages`
- `print_order_files.printable_page_count`
- `print_order_files.sheet_count`
- `print_order_files.copies`

Do not recalculate old history from current hub pricing or current UI defaults. History must use the saved snapshots from the time the order was created.
