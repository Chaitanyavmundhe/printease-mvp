export const OFFICIAL_BACKEND_URL =
  (process.env.PUBLIC_BACKEND_URL || 'https://printease-backend-byex.onrender.com').replace(/\/+$/, '');

function boundedPairingTtlSeconds(value, fallback) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(120, Math.max(60, Math.round(seconds)));
}

export const AGENT_PAIRING_TTL_SECONDS = boundedPairingTtlSeconds(
  process.env.AGENT_PAIRING_TTL_SECONDS,
  60
);

export const AGENT_APPROVAL_TTL_SECONDS = boundedPairingTtlSeconds(
  process.env.AGENT_APPROVAL_TTL_SECONDS || AGENT_PAIRING_TTL_SECONDS,
  AGENT_PAIRING_TTL_SECONDS
);

export const AGENT_POLL_INTERVAL_MS = Number(process.env.AGENT_POLL_INTERVAL_MS || 5000);

export const AGENT_AUTO_PRINT = false;

export function getAgentTokenSecret() {
  const secret = process.env.AGENT_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('AGENT_TOKEN_SECRET or JWT_SECRET must be configured');
  }

  return secret;
}
