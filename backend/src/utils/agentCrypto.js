import crypto from 'node:crypto';
import { getAgentTokenSecret } from '../config/agent.js';

export function createPairingCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function createAgentToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashAgentSecret(secret) {
  return crypto
    .createHmac('sha256', getAgentTokenSecret())
    .update(String(secret))
    .digest('hex');
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
