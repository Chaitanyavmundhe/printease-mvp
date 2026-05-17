import {
  createAgentToken,
  listAgentPrintersByAgent,
  revokeActiveAgentTokens,
  updateAgentHeartbeat,
  upsertAgentForDesktopDevice,
  withTransaction
} from '../db/repository.js';
import { createAgentToken as createRawAgentToken, hashAgentSecret } from '../utils/agentCrypto.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

function toSelectedPrinter(printers) {
  const selected = printers.find((printer) => printer.isDefault) || printers[0] || null;

  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    printerName: selected.printerName,
    systemPrinterId: selected.systemPrinterId,
    status: selected.status,
    isDefault: selected.isDefault
  };
}

export const registerDesktopDevice = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const { deviceId, deviceName, platform, version } = req.body;

  if (!hubId) {
    return res.status(400).json({ success: false, message: 'Logged in hub user is not linked to a hub' });
  }

  if (!deviceId || !deviceName) {
    return res.status(400).json({ success: false, message: 'Device ID and device name are required' });
  }

  const agentToken = createRawAgentToken();

  const agent = await withTransaction(async (client) => {
    const savedAgent = await upsertAgentForDesktopDevice({
      deviceId,
      deviceName,
      platform,
      version
    }, hubId, client);

    await revokeActiveAgentTokens(savedAgent.id, client);
    await createAgentToken({
      agentId: savedAgent.id,
      tokenHash: hashAgentSecret(agentToken)
    }, client);

    return savedAgent;
  });

  res.status(201).json({
    success: true,
    agentId: agent.id,
    hubId: agent.hubId,
    shopId: agent.hubId,
    agentToken,
    mode: 'login'
  });
});

export const desktopHeartbeat = asyncHandler(async (req, res) => {
  const agent = await updateAgentHeartbeat(req.agent.id, {
    status: req.body.status || 'online',
    paused: typeof req.body.paused === 'boolean' ? req.body.paused : req.agent.paused,
    platform: req.body.platform || req.agent.platform,
    version: req.body.version || req.agent.version
  });

  if (!agent) {
    return res.status(401).json({ success: false, message: 'Agent is revoked or unavailable' });
  }

  res.json({
    success: true,
    ok: true,
    agentId: agent.id,
    hubId: agent.hubId,
    shopId: agent.hubId,
    status: agent.status,
    paused: agent.paused,
    lastSeenAt: agent.lastSeenAt,
    serverTime: new Date().toISOString()
  });
});

export const getDesktopDeviceStatus = asyncHandler(async (req, res) => {
  const printers = await listAgentPrintersByAgent(req.agent.id, req.agent.hubId);
  const selectedPrinter = toSelectedPrinter(printers);

  res.json({
    success: true,
    agent: {
      id: req.agent.id,
      hubId: req.agent.hubId,
      shopId: req.agent.hubId,
      deviceId: req.agent.deviceId,
      deviceName: req.agent.agentName,
      status: req.agent.status,
      paused: req.agent.paused,
      revoked: Boolean(req.agent.revokedAt),
      platform: req.agent.platform,
      version: req.agent.version,
      lastSeenAt: req.agent.lastSeenAt
    },
    selectedPrinter,
    printers
  });
});
