import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';
import { mapUser } from './mappers.js';

export async function findUserById(id, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where u.id = $1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByMobile(mobile, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where u.mobile = $1`,
    [mobile]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByEmail(email, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where lower(u.email) = lower($1)`,
    [email]
  );
  return mapUser(result.rows[0]);
}

export async function findUserByUsername(username, client) {
  const result = await executor(client).query(
    `select
       u.*,
       h.id as hub_id,
       h.id as centre_id,
       h.hub_name,
       h.centre_code
     from users u
     left join print_hubs h on h.owner_id = u.id
     where lower(u.username) = lower($1)`,
    [username]
  );
  return mapUser(result.rows[0]);
}

export async function createUser(user, client) {
  const result = await executor(client).query(
    `insert into users (id, name, email, username, display_handle, mobile, password_hash, role, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9, now()))
     returning *, null::uuid as hub_id, null::uuid as centre_id, null::text as hub_name, null::text as centre_code`,
    [
      user.id,
      user.name,
      user.email || null,
      user.username || null,
      user.displayHandle || user.username || null,
      user.mobile || null,
      user.passwordHash || null,
      user.role,
      user.createdAt || null
    ]
  );

  return mapUser(result.rows[0]);
}

export async function updateUserProfile(userId, updates, client) {
  const result = await executor(client).query(
    `update users
     set name = coalesce($2, name),
         username = coalesce($3, username),
         display_handle = coalesce($4, display_handle),
         mobile = coalesce($5, mobile)
     where id = $1
     returning *`,
    [userId, updates.name, updates.username, updates.displayHandle, updates.mobile]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}
