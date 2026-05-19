import {
  createAgentToken,
  findPrintJobForAgent,
  insertPrintJobEvent,
  listDesktopOrdersForAgent,
  listDesktopPrintJobsForAgent,
  listAgentPrintersByAgent,
  revokeActiveAgentTokens,
  updateAgentHeartbeat,
  updateOrderStatus,
  updatePrintJobStatus,
  upsertAgentForDesktopDevice,
  withTransaction
} from '../db/repository.js';
import { createAgentToken as createRawAgentToken, hashAgentSecret } from '../utils/agentCrypto.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

const STATUS_TO_ORDER_STATUS = {
  accepted: 'Sent to Agent',
  downloading: 'Sent to Agent',
  printing: 'Printing',
  completed: 'Ready for Pickup',
  failed: 'Printing Failed',
  cancelled: 'Printing Failed'
};

const ALLOWED_DESKTOP_JOB_STATUSES = new Set([
  'accepted',
  'downloading',
  'printing',
  'completed',
  'failed',
  'cancelled'
]);

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

function parseSince(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toDesktopPrintJob(job) {
  if (!job) return null;

  return {
    jobId: job.id,
    orderId: job.orderId,
    hubId: job.hubId,
    shopId: job.hubId,
    agentId: job.agentId,
    printerName: job.printerName,
    status: job.status,
    fileSha256: job.fileSha256,
    fileHash: job.fileSha256,
    fileType: job.fileType,
    copies: job.copies,
    paperSize: job.paperSize,
    colorMode: job.colorMode,
    failureReasonCode: job.failureReasonCode,
    failureReasonText: job.failureReasonText,
    createdAt: job.createdAt,
    acceptedAt: job.acceptedAt,
    printingStartedAt: job.printingStartedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt
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

export const logDesktopPrinterDiagnostics = asyncHandler(async (req, res) => {
  const result = req.body?.result || {};
  const printers = Array.isArray(result.printers) ? result.printers : [];
  const probes = Array.isArray(result.probes) ? result.probes : [];

  console.log('[DESKTOP PRINTER DIAGNOSTIC]', {
    event: req.body?.event || 'unknown',
    deviceId: req.body?.deviceId || null,
    deviceName: req.body?.deviceName || null,
    platform: req.body?.platform || null,
    paired: Boolean(req.body?.paired),
    success: result.success,
    printerCount: printers.length,
    printers: printers.map((printer) => ({
      printerName: printer.printerName,
      status: printer.status,
      isDefault: printer.isDefault,
      rawStatus: printer.rawStatus
    })),
    error: result.error || result.message || null,
    probes: probes.map((probe) => ({
      command: probe.command,
      success: probe.success,
      stdout: probe.stdout,
      stderr: probe.stderr,
      error: probe.error
    }))
  });

  res.json({
    success: true,
    logged: true
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

export const syncDesktopOrders = asyncHandler(async (req, res) => {
  const since = parseSince(req.query.since);
  const orders = await listDesktopOrdersForAgent(req.agent.hubId, since);

  res.json({
    success: true,
    since,
    serverTime: new Date().toISOString(),
    orders
  });
});

export const syncDesktopPrintJobs = asyncHandler(async (req, res) => {
  const since = parseSince(req.query.since);
  const jobs = await listDesktopPrintJobsForAgent(req.agent.id, req.agent.hubId, since);

  res.json({
    success: true,
    since,
    serverTime: new Date().toISOString(),
    printJobs: jobs.map(toDesktopPrintJob)
  });
});

export const updateDesktopPrintJobStatus = asyncHandler(async (req, res) => {
  const nextStatus = String(req.body.status || '').trim().toLowerCase();

  if (!ALLOWED_DESKTOP_JOB_STATUSES.has(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported print job status'
    });
  }

  const result = await withTransaction(async (client) => {
    const existing = await findPrintJobForAgent(req.params.jobId, req.agent.id, req.agent.hubId, client);
    if (!existing) return null;

    const job = await updatePrintJobStatus(req.params.jobId, req.agent.hubId, {
      status: nextStatus,
      failureReasonCode: req.body.reasonCode || req.body.failureReasonCode,
      failureReasonText: req.body.reasonText || req.body.failureReasonText,
      agentId: req.agent.id
    }, client);

    if (!job) return null;

    await insertPrintJobEvent({
      printJobId: job.id,
      agentId: req.agent.id,
      eventType: nextStatus,
      oldStatus: existing.status,
      newStatus: nextStatus,
      message: req.body.message || req.body.reasonText || `Desktop reported ${nextStatus}`,
      rawStatus: req.body || {}
    }, client);

    const orderStatus = STATUS_TO_ORDER_STATUS[nextStatus];
    if (orderStatus) {
      await updateOrderStatus(job.orderId, req.agent.hubId, orderStatus, client);
    }

    return job;
  });

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Print job not found for this desktop device'
    });
  }

  res.json({
    success: true,
    printJob: toDesktopPrintJob(result)
  });
});

export const syncDesktopEvents = asyncHandler(async (req, res) => {
  const events = Array.isArray(req.body.events) ? req.body.events.slice(0, 50) : [];

  if (events.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one sync event is required' });
  }

  const result = await withTransaction(async (client) => {
    let synced = 0;
    const failed = [];

    for (const event of events) {
      const jobId = event.jobId || event.printJobId || event.remotePrintJobId;
      if (!jobId) {
        failed.push({ eventId: event.id || null, message: 'Missing print job ID' });
        continue;
      }

      const job = await findPrintJobForAgent(jobId, req.agent.id, req.agent.hubId, client);
      if (!job) {
        failed.push({ eventId: event.id || null, jobId, message: 'Print job not found for this agent' });
        continue;
      }

      await insertPrintJobEvent({
        printJobId: job.id,
        agentId: req.agent.id,
        eventType: event.eventType || event.actionType || 'desktop_event',
        oldStatus: event.oldStatus || null,
        newStatus: event.newStatus || event.status || null,
        message: event.message || null,
        rawStatus: event
      }, client);

      synced += 1;
    }

    return { synced, failed };
  });

  res.json({
    success: true,
    ...result
  });
});
