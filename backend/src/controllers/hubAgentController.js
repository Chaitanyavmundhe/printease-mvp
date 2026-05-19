import {
  claimPairingSession,
  createPrintJob,
  findAgentByIdAndHub,
  findOrderWithDocumentForHub,
  findPairingSessionById,
  findPendingApprovalPairingSessionById,
  findPendingPairingSessionByCodeHash,
  insertPrintJobEvent,
  listAgentPrintersByAgent,
  listAgentPrintersByHub,
  listAllAgentsByHub,
  listAgentsByHub,
  listPrintJobsByHub,
  rejectPairingSession,
  revokeAgent,
  setAgentPaused,
  updateOrderStatus,
  upsertAgentForPairing,
  approvePairingSession,
  withTransaction
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { getSupabaseBucketName } from '../config/supabase.js';
import { hashAgentSecret } from '../utils/agentCrypto.js';
import { buildHubAgentAnalytics, decorateAgent, decoratePrinter } from '../utils/hubAgentAnalytics.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

function isPaymentCollected(order) {
  return String(order.payment_status || '').toLowerCase() === 'collected';
}

function isPrintableOrderStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return !['printing', 'ready for pickup', 'collected', 'printing failed'].includes(normalized);
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const listHubAgents = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const [agents, printers, printJobs] = await Promise.all([
    listAgentsByHub(hubId),
    listAgentPrintersByHub(hubId),
    listPrintJobsByHub(hubId)
  ]);

  res.json({
    success: true,
    agents: agents.map(decorateAgent),
    printers: printers.map(decoratePrinter),
    printJobs,
    analytics: buildHubAgentAnalytics(agents, printers, printJobs)
  });
});

export const getHubAgentSummary = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const [agents, printers, printJobs] = await Promise.all([
    listAllAgentsByHub(hubId),
    listAgentPrintersByHub(hubId),
    listPrintJobsByHub(hubId)
  ]);

  res.json({
    success: true,
    agents: agents.map(decorateAgent),
    printers: printers.map(decoratePrinter),
    printJobs,
    analytics: buildHubAgentAnalytics(agents, printers, printJobs)
  });
});

export const pairAgentToHub = asyncHandler(async (req, res) => {
  const { pairingCode } = req.body;
  const hubId = getHubId(req);

  if (!pairingCode) {
    return res.status(400).json({ success: false, message: 'Pairing code is required' });
  }

  const result = await withTransaction(async (client) => {
    const session = await findPendingPairingSessionByCodeHash(hashAgentSecret(pairingCode), client);

    if (!session) return null;

    const agent = await upsertAgentForPairing(session, hubId, client);
    const claimedSession = await claimPairingSession(session.id, hubId, agent.id, client);
    if (!claimedSession) throw httpError('Pairing code not found or expired', 404);

    return { agent, pairingSession: claimedSession };
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'Pairing code not found or expired' });
  }

  res.json({
    success: true,
    message: 'Agent paired. Return to the local agent to confirm.',
    ...result
  });
});

export const getPairingSessionDetails = asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId;
  const session = await findPairingSessionById(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Pairing session not found' });
  }

  res.json({
    success: true,
    session: {
      id: session.id,
      agentName: session.agentName,
      platform: session.platform,
      version: session.version,
      expiresAt: session.expiresAt,
      approvalExpiresAt: session.approvalExpiresAt,
      status: session.status
    }
  });
});

export const approveAgentPairing = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const { pairingSessionId, approvalToken } = req.body;

  if (!pairingSessionId || !approvalToken) {
    return res.status(400).json({ success: false, message: 'Pairing session ID and approval token are required' });
  }

  const approvalTokenHash = hashAgentSecret(approvalToken);

  const result = await withTransaction(async (client) => {
    const session = await findPendingApprovalPairingSessionById(pairingSessionId, client);
    if (!session) return { reason: 'not_found' };

    if (approvalTokenHash !== session.approvalTokenHash) {
      return { reason: 'invalid_token' };
    }

    const agent = await upsertAgentForPairing(session, hubId, client);
    const approvedSession = await approvePairingSession(session.id, hubId, agent.id, client);
    if (!approvedSession) throw httpError('Pairing session could not be approved', 409);
    return { agent, pairingSession: approvedSession };
  });

  if (result?.reason === 'not_found') {
    return res.status(404).json({ success: false, message: 'Pairing session not found, expired, or already handled' });
  }

  if (result?.reason === 'invalid_token') {
    return res.status(403).json({ success: false, message: 'Invalid approval token' });
  }

  if (!result) {
    return res.status(409).json({ success: false, message: 'Pairing session could not be approved' });
  }

  res.json({
    success: true,
    message: 'Desktop device approved',
    agentId: result.agent.id,
    hubId,
    pairingSessionId: result.pairingSession.id
  });
});

export const rejectAgentPairing = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const { pairingSessionId } = req.body;

  if (!pairingSessionId) {
    return res.status(400).json({ success: false, message: 'Pairing session ID is required' });
  }

  const session = await findPairingSessionById(pairingSessionId);
  if (!session || session.status !== 'pending' || new Date(session.expiresAt).getTime() <= Date.now()) {
    return res.status(409).json({ success: false, message: 'Pairing session cannot be rejected' });
  }

  const rejectedSession = await withTransaction(async (client) => rejectPairingSession(session.id, hubId, client));

  if (!rejectedSession) {
    return res.status(409).json({ success: false, message: 'Pairing session cannot be rejected' });
  }

  res.json({
    success: true,
    message: 'Pairing request rejected',
    pairingSessionId: rejectedSession.id
  });
});

export const pauseAgent = asyncHandler(async (req, res) => {
  const agent = await setAgentPaused(req.params.agentId, getHubId(req), true);

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  res.json({
    success: true,
    message: 'New job assignment disabled for this desktop device. This does not stop the local printer.',
    agent
  });
});

export const resumeAgent = asyncHandler(async (req, res) => {
  const agent = await setAgentPaused(req.params.agentId, getHubId(req), false);

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  res.json({
    success: true,
    message: 'New job assignment enabled for this desktop device.',
    agent
  });
});

export const revokeHubAgent = asyncHandler(async (req, res) => {
  const agent = await revokeAgent(req.params.agentId, getHubId(req));

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  res.json({ success: true, agent });
});

export const sendOrderToAgent = asyncHandler(async (req, res) => {
  const hubId = getHubId(req);
  const { agentId, printerName } = req.body;
  const order = await findOrderWithDocumentForHub(req.params.orderId, hubId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found for this hub' });
  }

  if (!isPaymentCollected(order)) {
    return res.status(400).json({ success: false, message: 'Payment is not collected' });
  }

  if (!isPrintableOrderStatus(order.status)) {
    return res.status(400).json({ success: false, message: 'Order is not in a printable state' });
  }

  const storagePath = order.document_storage_path;
  const fileSha256 = order.document_file_sha256;
  const fileType = order.document_file_type || 'application/pdf';

  if (!storagePath || !fileSha256) {
    return res.status(400).json({
      success: false,
      message: 'Order document is not stored in secure private storage'
    });
  }

  if (fileType !== 'application/pdf') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF documents can be sent to the local agent'
    });
  }

  if (!agentId) {
    return res.status(400).json({
      success: false,
      message: 'Select a desktop device before sending to agent'
    });
  }

  const selectedAgent = await findAgentByIdAndHub(agentId, hubId);
  if (!selectedAgent) {
    return res.status(404).json({ success: false, message: 'Selected desktop device was not found' });
  }

  if (selectedAgent.paused) {
    return res.status(400).json({ success: false, message: 'Selected desktop device is disabled for new jobs' });
  }

  let printerHint = null;
  if (printerName) {
    const agentPrinters = await listAgentPrintersByAgent(selectedAgent.id, hubId);
    const selectedPrinter = agentPrinters.find((printer) => printer.printerName === printerName);

    if (!selectedPrinter) {
      return res.status(400).json({
        success: false,
        message: 'Selected printer does not belong to this desktop device'
      });
    }

    printerHint = selectedPrinter.printerName;
  }

  const printJob = await withTransaction(async (client) => {
    const job = await createPrintJob({
      id: generateId(),
      orderId: order.id,
      hubId,
      agentId: selectedAgent.id,
      printerName: printerHint || null,
      fileUrl: `private://${getSupabaseBucketName()}/${storagePath}`,
      fileSha256,
      fileType,
      copies: order.copies,
      paperSize: 'A4',
      colorMode: order.color_type || 'bw',
      sourceBackendUrl: OFFICIAL_BACKEND_URL
    }, client);

    await insertPrintJobEvent({
      printJobId: job.id,
      agentId: selectedAgent.id,
      eventType: 'queued',
      newStatus: 'queued',
      message: 'Hub queued order for PrintEase agent',
      rawStatus: {
        orderId: order.id,
        agentId: selectedAgent.id,
        printerName: selectedPrinter.printerName
      }
    }, client);

    await updateOrderStatus(order.id, hubId, 'Queued for Printing', client);

    return job;
  });

  res.status(201).json({
    success: true,
    message: 'Order queued for selected desktop printer',
    printJob
  });
});

export const listHubPrintJobs = asyncHandler(async (req, res) => {
  const printJobs = await listPrintJobsByHub(getHubId(req));
  res.json({ success: true, printJobs });
});
