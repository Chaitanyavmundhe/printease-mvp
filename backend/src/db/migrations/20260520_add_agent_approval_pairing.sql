alter table agent_pairing_sessions add column if not exists approval_token_hash text;
alter table agent_pairing_sessions add column if not exists public_key text;
alter table agent_pairing_sessions add column if not exists approved_at timestamptz;
alter table agent_pairing_sessions add column if not exists rejected_at timestamptz;
alter table agent_pairing_sessions add column if not exists approval_expires_at timestamptz;

update agent_pairing_sessions
set approval_expires_at = expires_at
where approval_expires_at is null;
