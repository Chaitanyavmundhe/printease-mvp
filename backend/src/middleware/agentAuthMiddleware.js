import { findActiveAgentByTokenHash } from '../db/repository.js';
import { hashAgentSecret } from '../utils/agentCrypto.js';

export async function agentAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Agent authorization token missing' });
  }

  try {
    const token = header.slice('Bearer '.length).trim();

    if (token.length < 32 || token.length > 512) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked agent token' });
    }

    const tokenHash = hashAgentSecret(token);
    const agent = await findActiveAgentByTokenHash(tokenHash);

    if (!agent) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked agent token' });
    }

    const headerAgentId = req.headers['x-printease-agent-id'];
    const headerDeviceId = req.headers['x-printease-device-id'];

    if (headerAgentId && headerAgentId !== agent.id) {
      return res.status(403).json({ success: false, message: 'Agent ID header does not match token' });
    }

    if (headerDeviceId && headerDeviceId !== agent.deviceId) {
      return res.status(403).json({ success: false, message: 'Device ID header does not match token' });
    }

    req.agent = agent;
    req.agentHub = { id: agent.hubId };
    next();
  } catch (error) {
    next(error);
  }
}
