alter table users add column if not exists email text;
alter table users add column if not exists username text;
alter table users add column if not exists display_handle text;
alter table users alter column mobile drop not null;
alter table users alter column password_hash drop not null;
create unique index if not exists users_email_unique on users (lower(email)) where email is not null;
create unique index if not exists users_username_unique on users (lower(username)) where username is not null;
