import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

import { query, executor, timestamp, number, isUuid, centreSelect } from './common.js';

export async function getNextConversionJobForAgent(hubId, client) {
  const result = await executor(client).query(
    `select d.*
     from documents d
     where d.hub_id = $1
       and d.requires_desktop_preparation = true
       and d.preparation_status = 'pending'
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
       paired_at = now()
     returning *`,
    [hubId, session.agentName, session.deviceId, session.platform || null, session.version || null]
  );

  return mapAgent(result.rows[0]);
}

export async function upsertAgentForDesktopDevice(device, hubId, client) {
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
       paired_at = coalesce(agents.paired_at, now())
     returning *`,
    [hubId, device.deviceName, device.deviceId, device.platform || null, device.version || null]
  );

  return mapAgent(result.rows[0]);
}

export async function claimPairingSession(sessionId, hubId, agentId, client) {
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'claimed',
         hub_id = $2,
         agent_id = $3,
         claimed_at = now()
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
         claimed_at = now(),
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
  const result = await executor(client).query(
    `update agent_pairing_sessions
     set status = 'confirmed'
     where id = $1
       and status = 'claimed'
     returning *`,
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
     set status = coalesce($2, status),
         paused = coalesce($3, paused),
         platform = coalesce($4, platform),
         version = coalesce($5, version),
         last_seen_at = now()
     where id = $1 and revoked_at is null
     returning *`,
    [agentId, updates.status, updates.paused, updates.platform, updates.version]
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
