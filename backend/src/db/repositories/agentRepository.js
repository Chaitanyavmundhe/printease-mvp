import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect, withTransaction } from './common.js';
import { mapDocument, mapPairingSession, mapAgent } from './mappers.js';

export async function getNextConversionJobForAgent(hubId, client) {
  const result = await executor(client).query(
    `select d.*
     from documents d
     where d.hub_id = $1
       and d.requires_desktop_preparation = true
       and d.preparation_status = 'pending'
       and (d.expires_at is null or d.expires_at > now())
       and not exists (
         select 1 from print_order_files f join print_orders o on o.id = f.order_id
         where f.document_id = d.id and o.hub_id <> $1
       )
     order by d.created_at asc
     limit 1`,
    [hubId]
  );
  return mapDocument(result.rows[0]);
}

export async function createAgentPairingSession(session, client) {
  const result = await executor(client).query(
    `insert into agent_pairing_sessions (
       id, pairing_code_hash, approval_token_hash, public_key,
       device_id, agent_name, platform, version, status,
       expires_at, approval_expires_at, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, coalesce($11, now()))
     returning *`,
    [
      session.id,
      session.pairingCodeHash,
      session.approvalTokenHash || null,
      session.publicKey || null,
      session.deviceId,
      session.agentName,
      session.platform || null,
      session.version || null,
      session.expiresAt,
      session.approvalExpiresAt || session.expiresAt,
      session.createdAt || null
    ]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPendingPairingSessionByCodeHash(pairingCodeHash, client) {
  const lockClause = client ? ' for update' : '';
  const result = await executor(client).query(
    `select *
     from agent_pairing_sessions
     where pairing_code_hash = $1
       and status = 'pending'
       and expires_at > now()
     order by created_at desc
     limit 1${lockClause}`,
    [pairingCodeHash]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPendingApprovalPairingSessionById(sessionId, client) {
  const lockClause = client ? ' for update' : '';
  const result = await executor(client).query(
    `select *
     from agent_pairing_sessions
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
       and approval_token_hash is not null
     limit 1${lockClause}`,
    [sessionId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPairingSessionById(sessionId, client) {
  const result = await executor(client).query(
    'select * from agent_pairing_sessions where id = $1',
    [sessionId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function findPairingSessionByIdAndDevice(sessionId, deviceId, client) {
  const result = await executor(client).query(
    'select * from agent_pairing_sessions where id = $1 and device_id = $2',
    [sessionId, deviceId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function upsertAgentForPairing(session, hubId, client) {
  if (!client) return withTransaction(tx => upsertAgentForPairing(session, hubId, tx));
  const result = await executor(client).query(
    `insert into agents (
       hub_id, agent_name, device_id, platform, version, status, paused, paired_at, revoked_at, created_at
     )
     values ($1, $2, $3, $4, $5, 'offline', false, now(), null, now())
     on conflict (device_id)
     do update set
       hub_id = excluded.hub_id,
       agent_name = excluded.agent_name,
       platform = excluded.platform,
       version = excluded.version,
       revoked_at = null,
       paired_at = clock_timestamp()
     where agents.hub_id = excluded.hub_id
     returning *`,
    [hubId, session.agentName, session.deviceId, session.platform || null, session.version || null]
  );

  if (!result.rows[0]) {
    const error = new Error('Device is already registered to another hub.');
    error.statusCode = 409;
    throw error;
  }
  await revokeActiveAgentTokens(result.rows[0].id, client);
  return mapAgent(result.rows[0]);
}

export async function upsertAgentForDesktopDevice(device, hubId, client) {
  if (!client) return withTransaction(tx => upsertAgentForDesktopDevice(device, hubId, tx));
  const result = await executor(client).query(
    `insert into agents (
       hub_id, agent_name, device_id, platform, version, status, paused, paired_at, revoked_at, created_at
     )
     values ($1, $2, $3, $4, $5, 'offline', false, now(), null, now())
     on conflict (device_id)
     do update set
       hub_id = excluded.hub_id,
       agent_name = excluded.agent_name,
       platform = excluded.platform,
       version = excluded.version,
       revoked_at = null,
       paired_at = clock_timestamp()
     where agents.hub_id = excluded.hub_id
     returning *`,
    [hubId, device.deviceName, device.deviceId, device.platform || null, device.version || null]
  );

  if (!result.rows[0]) {
    const error = new Error('Device is already registered to another hub.');
    error.statusCode = 409;
    throw error;
  }
  await revokeActiveAgentTokens(result.rows[0].id, client);
  return mapAgent(result.rows[0]);
}

export async function claimPairingSession(sessionId, hubId, agentId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'claimed',
         hub_id = $2,
         agent_id = $3,
         claimed_at = clock_timestamp()
     where id = $1
       and status = 'pending'
       and expires_at > now()
     returning *`,
    [sessionId, hubId, agentId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function approvePairingSession(sessionId, hubId, agentId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'claimed',
         hub_id = $2,
         agent_id = $3,
         claimed_at = clock_timestamp(),
         approved_at = now()
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
     returning *`,
    [sessionId, hubId, agentId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function rejectPairingSession(sessionId, hubId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'rejected',
         hub_id = $2,
         rejected_at = now()
     where id = $1
       and status = 'pending'
       and coalesce(approval_expires_at, expires_at) > now()
     returning *`,
    [sessionId, hubId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function markPairingSessionConfirmed(sessionId, client) {
  if (!client) return withTransaction(tx => markPairingSessionConfirmed(sessionId, tx));
  // Serialize token issuance with re-pairing and revocation of the agent.
  await client.query(
    `select a.id from agents a join agent_pairing_sessions s on s.agent_id = a.id
     where s.id = $1 for update of a`, [sessionId]
  );
  const result = await executor(client).query(
    `update agent_pairing_sessions s
     set status = 'confirmed'
     where s.id = $1
       and s.status = 'claimed'
       and (case when s.approved_at is not null then coalesce(s.approval_expires_at, s.expires_at) else s.expires_at end) > now()
       and exists (
         select 1 from agents a where a.id = s.agent_id and a.hub_id = s.hub_id
           and a.revoked_at is null and a.paired_at <= s.claimed_at
       )
     returning s.*`,
    [sessionId]
  );

  return mapPairingSession(result.rows[0]);
}

export async function createAgentToken(token, client) {
  const result = await executor(client).query(
    `insert into agent_tokens (agent_id, token_hash, expires_at)
     values ($1, $2, $3)
     returning *`,
    [token.agentId, token.tokenHash, token.expiresAt || null]
  );

  return result.rows[0];
}

export async function revokeActiveAgentTokens(agentId, client) {
  await executor(client).query(
    'update agent_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null',
    [agentId]
  );
}

export async function findActiveAgentByTokenHash(tokenHash, client) {
  const result = await executor(client).query(
    `select
       a.*,
       t.id as token_id,
       t.revoked_at as token_revoked_at,
       t.expires_at as token_expires_at
     from agent_tokens t
     join agents a on a.id = t.agent_id
     where t.token_hash = $1
       and t.revoked_at is null
       and a.revoked_at is null
       and (t.expires_at is null or t.expires_at > now())
     limit 1`,
    [tokenHash]
  );

  return mapAgent(result.rows[0]);
}

export async function updateAgentHeartbeat(agentId, updates, client) {
  const result = await executor(client).query(
    `update agents
     set status = case when paused then 'paused' else $2 end,
         platform = coalesce($3, platform),
         version = coalesce($4, version),
         last_seen_at = now()
     where id = $1 and revoked_at is null
     returning *`,
    [agentId, ['online', 'offline', 'busy'].includes(updates.status) ? updates.status : 'online', updates.platform, updates.version]
  );

  return mapAgent(result.rows[0]);
}

export async function listAgentsByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents
     where hub_id = $1 and revoked_at is null
     order by coalesce(last_seen_at, created_at) desc`,
    [hubId]
  );

  return result.rows.map(mapAgent);
}

export async function listAllAgentsByHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents
     where hub_id = $1
     order by coalesce(last_seen_at, created_at) desc`,
    [hubId]
  );

  return result.rows.map(mapAgent);
}

export async function findAgentByIdAndHub(agentId, hubId, client) {
  const result = await executor(client).query(
    'select * from agents where id = $1 and hub_id = $2 and revoked_at is null',
    [agentId, hubId]
  );

  return mapAgent(result.rows[0]);
}

export async function setAgentPaused(agentId, hubId, paused, client) {
  const result = await executor(client).query(
    `update agents
     set paused = $3,
         status = case when $3 then 'paused' else 'offline' end
     where id = $1 and hub_id = $2 and revoked_at is null
     returning *`,
    [agentId, hubId, paused]
  );

  return mapAgent(result.rows[0]);
}

export async function revokeAgent(agentId, hubId, client) {
  if (!client) return withTransaction(tx => revokeAgent(agentId, hubId, tx));
  const result = await executor(client).query(
    `update agents
     set revoked_at = now(),
         status = 'revoked'
     where id = $1 and hub_id = $2 and revoked_at is null
     returning *`,
    [agentId, hubId]
  );

  if (!result.rows[0]) return null;

  await executor(client).query(
    'update agent_tokens set revoked_at = now() where agent_id = $1 and revoked_at is null',
    [agentId]
  );

  return mapAgent(result.rows[0]);
}

export async function findBestAgentForHub(hubId, client) {
  const result = await executor(client).query(
    `select *
     from agents a
     where a.hub_id = $1
       and a.revoked_at is null
       and a.paused = false
     order by
       case when a.last_seen_at >= now() - interval '45 seconds' then 0 else 1 end asc,
       a.last_seen_at desc nulls last,
       a.created_at desc
     limit 1`,
    [hubId]
  );

  const row = result.rows[0];
  return row ? mapAgent(row) : null;
}

export async function findPreferredPrinterHintForAgent(agentId, client) {
  const result = await executor(client).query(
    `select printer_name
     from agent_printers
     where agent_id = $1
     order by is_default desc nulls last, last_checked_at desc nulls last, created_at desc
     limit 1`,
    [agentId]
  );

  return result.rows[0]?.printer_name || null;
}
