import {
  createAgentPairingSession,
  createAgentToken,
  findNextPrintJobForAgent,
  findOrderByIdOrCode,
  findPairingSessionByIdAndDevice,
  insertPrintJobEvent,
  listPendingPaymentOrderFilesForAgentPredownload,
  listOrderFiles,
  listPendingBillVerificationJobsForAgent,
  markPairingSessionConfirmed,
  replaceAgentPrinters,
  revokeActiveAgentTokens,
  updateAgentHeartbeat,
  updateOrderStatus,
  updatePrintJobStatus,
  updateDocumentPreparation,
  findDocumentById,
  findOrderIdsByDocumentId,
  withTransaction
} from '../../db/repository.js';
import {
  AGENT_APPROVAL_TTL_SECONDS,
  AGENT_AUTO_PRINT,
  AGENT_PAIRING_TTL_SECONDS,
  AGENT_POLL_INTERVAL_MS,
  OFFICIAL_BACKEND_URL
} from '../../config/agent.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../../config/supabase.js';
import { createAgentToken as createRawAgentToken, createPairingCode, hashAgentSecret } from '../../utils/agentCrypto.js';
import { generateId } from '../../utils/generateCode.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { toAgentJobPayload } from '../../services/agentJobPayloadService.js';
import { resolveDownloadUrl } from '../../services/agentJobPayloadService.js';
import { PRINT_JOB_STATUSES, PAIRING_STATUSES } from '../../constants/statuses.js';
import { getPrintReadyFile } from '../../utils/printReadyPdf.js';
import { recalculateOrderPricingByDocument } from '../../services/orderConfigurationService.js';
import { verifyAndStoreHubConvertedDocument } from '../../services/documentVerificationService.js';

const JOB_STATUS_TO_ORDER_STATUS = {
  [PRINT_JOB_STATUSES.ACCEPTED]: 'queued_for_print',
  [PRINT_JOB_STATUSES.DOWNLOADING]: 'queued_for_print',
  [PRINT_JOB_STATUSES.PRINTING]: 'printing',
  [PRINT_JOB_STATUSES.COMPLETED]: 'completed',
  [PRINT_JOB_STATUSES.FAILED]: 'failed',
  [PRINT_JOB_STATUSES.CANCELLED]: 'cancelled'
};

async function agentCanPrepareDocument(documentId, hubId) {
  const orderIds = await findOrderIdsByDocumentId(documentId);
  for (const orderId of orderIds) {
    const order = await findOrderByIdOrCode(orderId);
    if (order?.centreId === hubId) return true;
  }
  return false;
}

function normalizePreparationStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['pending', 'prepared', 'failed'].includes(normalized)) return normalized;
  return null;
}

function normalizePreparedPageCount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

async function validateAgentDocumentPreparationInput({ documentId, hubId, preparationStatus, hasPrintReadyFile }) {
  if (!documentId) {
    return { error: { status: 400, message: 'documentId is required' } };
  }

  const normalizedStatus = normalizePreparationStatus(preparationStatus);
  if (!normalizedStatus) {
    return { error: { status: 400, message: 'preparationStatus must be pending, prepared, or failed' } };
  }

  const document = await findDocumentById(documentId);
  if (!document) {
    return { error: { status: 404, message: 'Document not found' } };
  }

  if (!(await agentCanPrepareDocument(documentId, hubId))) {
    return { error: { status: 403, message: 'Document does not belong to this hub' } };
  }

  if (normalizedStatus === 'prepared' && document.requiresDesktopPreparation && !hasPrintReadyFile) {
    return { error: { status: 400, message: 'Converted print-ready PDF is required for desktop-prepared documents' } };
  }

  return { document, preparationStatus: normalizedStatus };
}

function getPairingExpiry() {
  return new Date(Date.now() + AGENT_PAIRING_TTL_SECONDS * 1000).toISOString();
}

function getApprovalExpiry() {
  return new Date(Date.now() + AGENT_APPROVAL_TTL_SECONDS * 1000).toISOString();
}


const startPairing = asyncHandler(async (req, res) => {
  const { deviceId, agentName, platform, version, publicKey } = req.body;

  if (!deviceId || !agentName) {
    return res.status(400).json({ success: false, message: 'Device ID and agent name are required' });
  }

  const pairingCode = createPairingCode();
  const approvalToken = createRawAgentToken();
  const pairingExpiresAt = getPairingExpiry();
  const approvalExpiresAt = getApprovalExpiry();
  const session = await createAgentPairingSession({
    id: generateId(),
    pairingCodeHash: hashAgentSecret(pairingCode),
    approvalTokenHash: hashAgentSecret(approvalToken),
    publicKey: publicKey || null,
    deviceId,
    agentName,
    platform,
    version,
    expiresAt: pairingExpiresAt,
    approvalExpiresAt,
    createdAt: new Date().toISOString()
  });

  const frontendUrl = String(process.env.FRONTEND_URL || 'https://printhubdesi.vercel.app').replace(/\/+$/, '');
  const approvalUrl = `${frontendUrl}/hub/printers/approve-agent?session=${encodeURIComponent(session.id)}&token=${encodeURIComponent(approvalToken)}`;

  res.status(201).json({
    success: true,
    pairingCode,
    pairingSessionId: session.id,
    approvalUrl,
    expiresAt: session.approvalExpiresAt,
    pairingCodeExpiresAt: session.expiresAt,
    approvalExpiresAt,
    expiresInSeconds: AGENT_APPROVAL_TTL_SECONDS
  });
});

const confirmPairing = asyncHandler(async (req, res) => {
  const { pairingSessionId, deviceId } = req.body;

  if (!pairingSessionId || !deviceId) {
    return res.status(400).json({ success: false, message: 'Pairing session ID and device ID are required' });
  }

  const session = await findPairingSessionByIdAndDevice(pairingSessionId, deviceId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Pairing session not found' });
  }

  if (session.status === PAIRING_STATUSES.REJECTED) {
    return res.status(403).json({ success: false, message: 'Pairing request was rejected' });
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ success: false, paired: false, message: 'Pairing session expired' });
  }

  if (session.status === PAIRING_STATUSES.PENDING) {
    return res.status(202).json({ success: true, message: 'Waiting for hub approval', status: 'pending' });
  }

  if (session.status !== PAIRING_STATUSES.CLAIMED) {
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

    await revokeActiveAgentTokens(session.agentId, client);

    await createAgentToken({
      agentId: session.agentId,
      tokenHash: hashAgentSecret(accessToken)
    }, client);

    await createAgentToken({
      agentId: session.agentId,
      tokenHash: hashAgentSecret(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
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

const heartbeat = asyncHandler(async (req, res) => {
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

const getAgentConfig = asyncHandler(async (req, res) => {
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
  if ([PRINT_JOB_STATUSES.PRINTING, 'processing'].includes(value)) return PRINT_JOB_STATUSES.PRINTING;
  if (['paused', 'disabled', 'stopped'].includes(value)) return 'paused';
  if (['offline', 'unable', 'disconnected'].includes(value)) return 'offline';
  return 'unknown';
}

function normalizePrinterStatus(condition) {
  if (condition === 'available') return 'online';
  if (condition === PRINT_JOB_STATUSES.PRINTING) return 'busy';
  if (condition === 'paused') return 'paused';
  if (condition === 'offline') return 'offline';
  return 'unknown';
}

const syncPrinters = asyncHandler(async (req, res) => {
  const printers = Array.isArray(req.body.printers) ? req.body.printers : [];
  const normalizedPrinters = printers
    .map((printer) => {
      const rawCondition = String(printer.condition || '').trim().toLowerCase();
      const conditionInput = rawCondition && rawCondition !== 'unknown' ? printer.condition : printer.status;
      const condition = normalizePrinterCondition(conditionInput, printer.accepting);

      return {
        printerName: printer.printerName || printer.name,
        systemPrinterId: printer.systemPrinterId || printer.id || printer.name,
        status: normalizePrinterStatus(condition),
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
      const eventType = nextJob._claimedByAgent ? 'claimed_by_agent' : 'assigned';
      const eventMessage = nextJob._claimedByAgent
        ? 'Unassigned print job claimed by desktop agent.'
        : 'Job assigned to agent';

      await insertPrintJobEvent({
        printJobId: nextJob.id,
        agentId: req.agent.id,
        eventType,
        newStatus: nextJob.status,
        message: eventMessage,
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

export const getPredownloadCandidates = asyncHandler(async (req, res) => {
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 15));
  const candidates = await listPendingPaymentOrderFilesForAgentPredownload(req.agent.hubId, { limit });

  const files = await Promise.all(candidates.map(async (candidate) => {
    const order = {
      id: candidate.orderId,
      orderCode: candidate.orderCode,
      pickupCode: candidate.pickupCode,
    };
    const printReadyFile = await getPrintReadyFile(order, candidate.file);
    const sourceFileUrl = printReadyFile?.fileUrl || (
      candidate.file.document?.storagePath
        ? `private://${getSupabaseBucketName()}/${candidate.file.document.storagePath}`
        : null
    );

    if (!sourceFileUrl) return null;

    return {
      orderId: candidate.orderId,
      orderCode: candidate.orderCode,
      pickupCode: candidate.pickupCode,
      paymentStatus: candidate.paymentStatus,
      orderStatus: candidate.orderStatus,
      documentId: candidate.file.documentId,
      orderFileId: candidate.file.id,
      fileName: candidate.file.document?.fileName || 'document.pdf',
      fileType: printReadyFile?.fileType || candidate.file.document?.fileType || 'application/pdf',
      fileSha256: printReadyFile?.fileSha256 || candidate.file.document?.fileSha256 || null,
      fileUrl: await resolveDownloadUrl(sourceFileUrl),
      printReady: Boolean(printReadyFile?.transformed),
      requiresDesktopPreparation: candidate.file.document?.requiresDesktopPreparation || false,
      preparationStatus: candidate.file.document?.preparationStatus || 'prepared'
    };
  }));

  // Guardrail: this endpoint is for local cache warm-up only. It never creates,
  // assigns, or activates print_jobs, so the desktop cannot print before payment.
  res.json({
    success: true,
    mode: 'predownload_only',
    files: files.filter((file) => file?.documentId && file?.fileUrl && file?.fileSha256),
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
    nextStatus: PRINT_JOB_STATUSES.ACCEPTED,
    eventType: 'accepted',
    message: 'Agent accepted print job'
  });
});

export const markDownloading = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: PRINT_JOB_STATUSES.DOWNLOADING,
    eventType: 'downloading',
    message: 'Agent started downloading document'
  });
});

export const markPrinting = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: PRINT_JOB_STATUSES.PRINTING,
    eventType: 'printing',
    message: 'Agent started printing'
  });
});

export const markCompleted = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: PRINT_JOB_STATUSES.COMPLETED,
    eventType: 'completed',
    message: 'Agent completed print job'
  });
});

export const markFailed = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: PRINT_JOB_STATUSES.FAILED,
    eventType: 'failed',
    message: req.body.reasonText || 'Agent reported print failure'
  });
});

export const markCancelled = asyncHandler((req, res) => {
  return updateJobFromAgent({
    req,
    res,
    nextStatus: PRINT_JOB_STATUSES.CANCELLED,
    eventType: 'cancelled',
    message: req.body.reasonText || 'Agent stopped print job after hub cancellation'
  });
});

const reportPreparationResult = asyncHandler(async (req, res) => {
  const { documentId, errorCode, errorMessage } = req.body;
  const validation = await validateAgentDocumentPreparationInput({
    documentId,
    hubId: req.agent.hubId,
    preparationStatus: req.body.preparationStatus,
    hasPrintReadyFile: Boolean(req.file?.buffer)
  });

  if (validation.error) {
    return res.status(validation.error.status).json({ success: false, message: validation.error.message });
  }

  const preparationStatus = validation.preparationStatus;
  let preparedPageCount = normalizePreparedPageCount(req.body.preparedPageCount);
  let printReadyStoragePath = null;
  let printReadySha256 = null;

  if (req.file && req.file.buffer && preparationStatus === 'prepared') {
    try {
      const verification = await verifyAndStoreHubConvertedDocument({
        documentId,
        originalFileName: req.file.originalname,
        pdfBuffer: req.file.buffer
      });
      preparedPageCount = verification.verifiedPageCount;
      printReadyStoragePath = verification.printReadyStoragePath;
      printReadySha256 = verification.printReadySha256;
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  const result = await updateDocumentPreparation(documentId, {
    preparedPageCount,
    preparationStatus,
    preparationErrorCode: errorCode,
    preparationErrorMessage: errorMessage,
    printReadyStoragePath,
    printReadySha256,
    preparedAt: new Date().toISOString()
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  // We no longer update order prices or cancel orders here because
  // document conversion happens independently of order creation.

  res.json({ success: true, document: result });
});

const getPendingVerificationJobs = asyncHandler(async (req, res) => {
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 15));
  const candidates = await listPendingBillVerificationJobsForAgent(req.agent.hubId, { limit });
  
  const files = await Promise.all(candidates.map(async (candidate) => {
    const order = {
      id: candidate.orderId,
      orderCode: candidate.orderCode,
    };
    const printReadyFile = await getPrintReadyFile(order, candidate.file);
    const sourceFileUrl = printReadyFile?.fileUrl || (
      candidate.file.document?.storagePath
        ? `private://${getSupabaseBucketName()}/${candidate.file.document.storagePath}`
        : null
    );

    if (!sourceFileUrl) return null;

    return {
      orderId: candidate.orderId,
      orderCode: candidate.orderCode,
      orderStatus: candidate.orderStatus,
      documentId: candidate.file.documentId,
      orderFileId: candidate.file.id,
      fileName: candidate.file.document?.fileName || 'document.pdf',
      fileType: printReadyFile?.fileType || candidate.file.document?.fileType || 'application/pdf',
      fileSha256: printReadyFile?.fileSha256 || candidate.file.document?.fileSha256 || null,
      fileUrl: await resolveDownloadUrl(sourceFileUrl),
      printReady: Boolean(printReadyFile?.transformed),
      requiresDesktopPreparation: candidate.file.document?.requiresDesktopPreparation || false,
      preparationStatus: candidate.file.document?.preparationStatus || 'prepared'
    };
  }));

  res.json({
    success: true,
    mode: 'verification',
    files: files.filter(f => f?.documentId && f?.fileUrl && f?.fileSha256)
  });
});

const reportVerificationResult = asyncHandler(async (req, res) => {
  const { jobId } = req.params; // jobId is orderId here
  const { documentId, errorCode, errorMessage } = req.body;
  const validation = await validateAgentDocumentPreparationInput({
    documentId,
    hubId: req.agent.hubId,
    preparationStatus: req.body.preparationStatus,
    hasPrintReadyFile: Boolean(req.file?.buffer)
  });

  if (validation.error) {
    return res.status(validation.error.status).json({ success: false, message: validation.error.message });
  }

  const preparationStatus = validation.preparationStatus;
  let preparedPageCount = normalizePreparedPageCount(req.body.preparedPageCount);
  let { printReadySha256 } = req.body;
  let printReadyStoragePath = null;

  if (req.file && req.file.buffer && preparationStatus === 'prepared') {
    try {
      const verification = await verifyAndStoreHubConvertedDocument({
        documentId,
        originalFileName: req.file.originalname,
        pdfBuffer: req.file.buffer
      });
      preparedPageCount = verification.verifiedPageCount;
      printReadyStoragePath = verification.printReadyStoragePath;
      printReadySha256 = verification.printReadySha256;
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
  
  // 1. Update Document Preparation Status
  const result = await updateDocumentPreparation(documentId, {
    preparedPageCount,
    preparationStatus,
    preparationErrorCode: errorCode,
    preparationErrorMessage: errorMessage,
    printReadyStoragePath,
    printReadySha256,
    preparedAt: new Date().toISOString()
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  // 2. Automate Bill Confirmation if prepared
  if (preparationStatus === 'prepared') {
    // We import confirmOrderBill to run the backend verification logic
    const { confirmOrderBill } = await import('../../services/orderConfigurationService.js');
    try {
      // confirmOrderBill will automatically recalculate and set the bill_status = confirmed / mismatch
      // and allow payment requests.
      const updatedOrder = await confirmOrderBill({ orderId: jobId, hubId: req.agent.hubId, agentId: req.agent.id, isAutomatic: true });
      return res.json({ success: true, document: result, order: updatedOrder });
    } catch (err) {
      console.error(`[AgentController] Error confirming bill for order ${jobId}:`, err);
      return res.status(400).json({ success: false, message: err.message || 'Failed to confirm bill' });
    }
  } else if (preparationStatus === 'failed') {
    const { query } = await import('../../db/repository.js');
    const failMessage = errorMessage || 'Document conversion failed. Please save as PDF and try again.';
    try {
      await query(
        `update print_orders 
         set status = 'cancelled', 
             price_snapshot = jsonb_set(coalesce(price_snapshot, '{}'::jsonb), '{message}', $1::jsonb)
         where id = $2 and hub_id = $3`,
        [JSON.stringify(failMessage), jobId, req.agent.hubId]
      );
    } catch (err) {
      console.error(`[AgentController] Error cancelling failed order ${jobId}:`, err);
    }
  }

  res.json({ success: true, document: result });
});
