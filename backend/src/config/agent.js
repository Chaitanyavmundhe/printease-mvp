export const OFFICIAL_BACKEND_URL =
  (process.env.PUBLIC_BACKEND_URL || 'https://printease-backend-byex.onrender.com').replace(/\/+$/, '');

export const AGENT_PAIRING_TTL_MINUTES = Number(process.env.AGENT_PAIRING_TTL_MINUTES || 10);

export const AGENT_POLL_INTERVAL_MS = Number(process.env.AGENT_POLL_INTERVAL_MS || 5000);

export const AGENT_AUTO_PRINT = false;

export function getAgentTokenSecret() {
  const secret = process.env.AGENT_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('AGENT_TOKEN_SECRET or JWT_SECRET must be configured');
  }

  return secret;
}
