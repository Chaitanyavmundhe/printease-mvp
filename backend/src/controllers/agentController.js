import {
  createAgentPairingSession,
  createAgentToken,
  findNextPrintJobForAgent,
  findPairingSessionByIdAndDevice,
  insertPrintJobEvent,
  markPairingSessionConfirmed,
  replaceAgentPrinters,
  updateAgentHeartbeat,
  updateOrderStatus,
  updatePrintJobStatus,
  withTransaction
} from '../db/repository.js';
import {
  AGENT_AUTO_PRINT,
  AGENT_PAIRING_TTL_SECONDS,
  AGENT_POLL_INTERVAL_MS,
  OFFICIAL_BACKEND_URL
} from '../config/agent.js';
import { getSupabaseAdminClient } from '../config/supabase.js';
import { createAgentToken as createRawAgentToken, createPairingCode, hashAgentSecret } from '../utils/agentCrypto.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const JOB_STATUS_TO_ORDER_STATUS = {
  accepted: 'Sent to Agent',
  downloading: 'Sent to Agent',
  printing: 'Printing',
  completed: 'Ready for Pickup',
  failed: 'Printing Failed'
};

function getPairingExpiry() {
  return new Date(Date.now() + AGENT_PAIRING_TTL_SECONDS * 1000).toISOString();
}

function parsePrivateStorageReference(fileUrl) {
  if (!String(fileUrl || '').startsWith('private://')) {
    return null;
  }

  const withoutProtocol = String(fileUrl).slice('private://'.length);
  const separatorIndex = withoutProtocol.indexOf('/');

  if (separatorIndex === -1) {
    return null;
  }

  return {
    bucket: withoutProtocol.slice(0, separatorIndex),
    storagePath: withoutProtocol.slice(separatorIndex + 1)
  };
}

async function resolveDownloadUrl(fileUrl) {
  const privateReference = parsePrivateStorageReference(fileUrl);

  if (!privateReference) {
    return fileUrl;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(privateReference.bucket)
    .createSignedUrl(privateReference.storagePath, 10 * 60);

  if (error || !data?.signedUrl) {
    const signedUrlError = new Error(error?.message || 'Could not create signed document URL');
    signedUrlError.statusCode = 502;
    throw signedUrlError;
  }

  return data.signedUrl;
}

// Agent document access is gated by payment_status and print_jobs approval.
async function toAgentJobPayload(job) {
  if (!job) return null;

  const signedFileUrl = await resolveDownloadUrl(job.fileUrl);

  return {
    jobId: job.id,
    orderId: job.orderId,
    hubId: job.hubId,
    agentId: job.agentId,
    sourceBackendUrl: OFFICIAL_BACKEND_URL,
    fileUrl: signedFileUrl,
    fileSha256: job.fileSha256,
    fileHash: job.fileSha256,
    fileType: job.fileType,
    copies: job.copies,
    paperSize: job.paperSize,
    colorMode: job.colorMode,
    paymentVerified: true,
    approvedForPrint: true,
    printable: true,
    status: job.status,
    createdAt: job.createdAt
  };
}

export const startPairing = asyncHandler(async (req, res) => {
  const { deviceId, agentName, platform, version } = req.body;

  if (!deviceId || !agentName) {
    return res.status(400).json({ success: false, message: 'Device ID and agent name are required' });
  }

  const pairingCode = createPairingCode();
  const session = await createAgentPairingSession({
    id: generateId(),
    pairingCodeHash: hashAgentSecret(pairingCode),
    deviceId,
    agentName,
    platform,
    version,
    expiresAt: getPairingExpiry(),
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    pairingCode,
    pairingSessionId: session.id,
    expiresAt: session.expiresAt,
    expiresInSeconds: AGENT_PAIRING_TTL_SECONDS
  });
});

export const confirmPairing = asyncHandler(async (req, res) => {
  const { pairingSessionId, deviceId } = req.body;

  if (!pairingSessionId || !deviceId) {
    return res.status(400).json({ success: false, message: 'Pairing session ID and device ID are required' });
  }

  const session = await findPairingSessionByIdAndDevice(pairingSessionId, deviceId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Pairing session not found' });
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ success: false, message: 'Pairing code expired' });
  }

  if (session.status === 'pending') {
    return res.status(202).json({
      success: true,
      paired: false,
      message: 'Pairing is still pending'
    });
  }

  if (session.status !== 'claimed') {
    return res.status(409).json({
      success: false,
      paired: false,
      message: 'Pairing session has already been used or is no longer claimable'
    });
  }

  if (!session.agentId || !session.hubId) {
    return res.status(409).json({ success: false, message: 'Pairing session is incomplete' });
  }

  const accessToken = createRawAgentToken();
  const refreshToken = createRawAgentToken();

  const confirmedSession = await withTransaction(async (client) => {
    const markedSession = await markPairingSessionConfirmed(session.id, client);
    if (!markedSession) return null;

    await createAgentToken({
      agentId: session.agentId,
      tokenHash: hashAgentSecret(accessToken)
    }, client);

    return markedSession;
  });

  if (!confirmedSession) {
    return res.status(409).json({
      success: false,
      paired: false,
      message: 'Pairing session has already been used or is no longer claimable'
    });
  }

  res.json({
    success: true,
    paired: true,
    agentId: session.agentId,
    hubId: session.hubId,
    shopId: session.hubId,
    accessToken,
    refreshToken
  });
});

export const heartbeat = asyncHandler(async (req, res) => {
  const agent = await updateAgentHeartbeat(req.agent.id, {
    status: req.body.status || 'online',
    paused: typeof req.body.paused === 'boolean' ? req.body.paused : req.agent.paused,
    platform: req.body.platform || req.agent.platform,
    version: req.body.version || req.agent.version
  });

  res.json({
    success: true,
    ok: true,
    serverTime: new Date().toISOString(),
    agentStatus: agent.status,
    paused: agent.paused,
    config: {
      pollIntervalMs: AGENT_POLL_INTERVAL_MS,
      autoPrint: AGENT_AUTO_PRINT
    }
  });
});

export const getAgentConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    config: {
      pollIntervalMs: AGENT_POLL_INTERVAL_MS,
      autoPrint: AGENT_AUTO_PRINT,
      sourceBackendUrl: OFFICIAL_BACKEND_URL
    }
  });
});

function normalizePrinterCondition(input, accepting) {
  const value = String(input || '').trim().toLowerCase();
  if (accepting === false || value.includes('not accepting')) return 'paused';
  if (['idle', 'available', 'enabled', 'accepting'].includes(value)) return 'available';
  if (['printing', 'processing'].includes(value)) return 'printing';
  if (['paused', 'disabled', 'stopped'].includes(value)) return 'paused';
  if (['offline', 'unable', 'disconnected'].includes(value)) return 'offline';
  return 'unknown';
}

export const syncPrinters = asyncHandler(async (req, res) => {
  const printers = Array.isArray(req.body.printers) ? req.body.printers : [];
  const normalizedPrinters = printers
    .map((printer) => {
      const rawCondition = String(printer.condition || '').trim().toLowerCase();
      const conditionInput = rawCondition && rawCondition !== 'unknown' ? printer.condition : printer.status;
      const condition = normalizePrinterCondition(conditionInput, printer.accepting);

      return {
        printerName: printer.printerName || printer.name,
        systemPrinterId: printer.systemPrinterId || printer.id || printer.name,
        status: printer.status || condition,
        condition,
        accepting: typeof printer.accepting === 'boolean' ? printer.accepting : null,
        isDefault: Boolean(printer.isDefault),
        lastCheckedAt: printer.lastCheckedAt || null,
        warningCode: printer.warningCode || null,
        warningText: printer.warningText || null
      };
    })
    .filter((printer) => printer.printerName);

  const savedPrinters = await replaceAgentPrinters(req.agent.id, req.agent.hubId, normalizedPrinters);

  res.json({
    success: true,
    printers: savedPrinters
  });
});

export const getNextJob = asyncHandler(async (req, res) => {
  const job = await withTransaction(async (client) => {
    const nextJob = await findNextPrintJobForAgent(req.agent.id, req.agent.hubId, client);

    if (nextJob) {
      await insertPrintJobEvent({
        printJobId: nextJob.id,
        agentId: req.agent.id,
        eventType: 'assigned',
        newStatus: nextJob.status,
        message: 'Job assigned to agent',
        rawStatus: { source: 'agent_poll' }
      }, client);
    }

    return nextJob;
  });

  res.json({
    success: true,
    job: await toAgentJobPayload(job)
  });
});

async function updateJobFromAgent({ req, res, nextStatus, eventType, message }) {
  const result = await withTransaction(async (client) => {
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
      eventType,
      newStatus: nextStatus,
      message,
      rawStatus: req.body || {}
    }, client);

    const orderStatus = JOB_STATUS_TO_ORDER_STATUS[nextStatus];
    if (orderStatus) {
      await updateOrderStatus(job.orderId, req.agent.hubId, orderStatus, client);
    }

    return job;
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'Print job not found for this agent' });
  }

  return res.json({
    success: true,
    job: result
  });
}

export const acceptJob = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: 'accepted',
    eventType: 'accepted',
    message: 'Agent accepted print job'
  });
});

export const markDownloading = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: 'downloading',
    eventType: 'downloading',
    message: 'Agent started downloading document'
  });
});

export const markPrinting = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: 'printing',
    eventType: 'printing',
    message: 'Agent started printing'
  });
});

export const markCompleted = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: 'completed',
    eventType: 'completed',
    message: 'Agent completed print job'
  });
});

export const markFailed = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: 'failed',
    eventType: 'failed',
    message: req.body.reasonText || 'Agent reported print failure'
  });
});
