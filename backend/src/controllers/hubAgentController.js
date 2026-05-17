import {
  claimPairingSession,
  createPrintJob,
  findAgentByIdAndHub,
  findOrderWithDocumentForHub,
  findPendingPairingSessionByCodeHash,
  insertPrintJobEvent,
  listAgentPrintersByAgent,
  listAgentPrintersByHub,
  listAgentsByHub,
  listPrintJobsByHub,
  revokeAgent,
  setAgentPaused,
  updateOrderStatus,
  upsertAgentForPairing,
  withTransaction
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { getSupabaseBucketName } from '../config/supabase.js';
import { hashAgentSecret } from '../utils/agentCrypto.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getHubId(req) {
  return req.user?.centreId || req.user?.hubId;
}

function isPaymentVerified(order) {
  return String(order.payment_status || '').toLowerCase() === 'verified';
}

function isPrintableOrderStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return !['printing', 'ready for pickup', 'collected', 'printing failed'].includes(normalized);
}

function withLiveAgentStatus(agent) {
  if (!agent?.lastSeenAt || agent.paused || agent.status === 'revoked') {
    return agent;
  }

  const lastSeenMs = new Date(agent.lastSeenAt).getTime();
  if (Number.isNaN(lastSeenMs)) return agent;

  const isStale = Date.now() - lastSeenMs > 45 * 1000;
  return isStale ? { ...agent, status: 'offline' } : agent;
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
    agents: agents.map(withLiveAgentStatus),
    printers,
    printJobs
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
    if (!claimedSession) return null;

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

export const pauseAgent = asyncHandler(async (req, res) => {
  const agent = await setAgentPaused(req.params.agentId, getHubId(req), true);

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  res.json({ success: true, agent });
});

export const resumeAgent = asyncHandler(async (req, res) => {
  const agent = await setAgentPaused(req.params.agentId, getHubId(req), false);

  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }

  res.json({ success: true, agent });
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

  if (!isPaymentVerified(order)) {
    return res.status(400).json({ success: false, message: 'Payment is not verified' });
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

  if (!agentId || !printerName) {
    return res.status(400).json({
      success: false,
      message: 'Select a desktop device and printer before sending to agent'
    });
  }

  const selectedAgent = await findAgentByIdAndHub(agentId, hubId);
  if (!selectedAgent) {
    return res.status(404).json({ success: false, message: 'Selected desktop device was not found' });
  }

  if (selectedAgent.paused) {
    return res.status(400).json({ success: false, message: 'Selected desktop device is paused' });
  }

  const agentPrinters = await listAgentPrintersByAgent(selectedAgent.id, hubId);
  const selectedPrinter = agentPrinters.find((printer) => printer.printerName === printerName);

  if (!selectedPrinter) {
    return res.status(400).json({
      success: false,
      message: 'Selected printer does not belong to this desktop device'
    });
  }

  const printJob = await withTransaction(async (client) => {
    const job = await createPrintJob({
      id: generateId(),
      orderId: order.id,
      hubId,
      agentId: selectedAgent.id,
      printerName: selectedPrinter.printerName,
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
