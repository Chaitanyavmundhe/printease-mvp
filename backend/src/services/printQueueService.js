import {
  createPrintJob,
  findActivePrintJobByOrder,
  findBestAvailableAgentPrinterForHub,
  findOrderWithDocumentForHub,
  listAgentPrintersByHub,
  listAgentsByHub,
  insertPrintJobEvent,
  updateOrderStatus
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { getSupabaseBucketName } from '../config/supabase.js';
import { generateId } from '../utils/generateCode.js';
import { getAgentLiveStatus, getPrinterCondition } from '../utils/hubAgentAnalytics.js';

const PAYMENT_READY_STATUSES = new Set(['verified', 'collected']);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isPrintableOrderStatus(status) {
  const normalized = normalize(status);
  return !['printing', 'ready for pickup', 'collected', 'printing failed'].includes(normalized);
}

function paymentReadyMessage(paymentStatus, text) {
  const prefix = normalize(paymentStatus) === 'collected' ? 'Payment collected' : 'Payment verified';
  return `${prefix}. ${text}`;
}

function isRouteablePrinter(printer) {
  const condition = getPrinterCondition(printer);
  return printer?.accepting !== false && condition === 'available';
}

async function describeNoAvailablePrinter(hubId, client) {
  const [agents, printers] = await Promise.all([
    listAgentsByHub(hubId, client),
    listAgentPrintersByHub(hubId, client)
  ]);

  if (!agents.length) return 'No paired desktop device found. Pair PrintEase Desktop first.';

  const onlineAgents = agents.filter((agent) => getAgentLiveStatus(agent) === 'online');
  if (!onlineAgents.length) return 'No online desktop device. Start PrintEase Desktop and wait for heartbeat.';

  const enabledAgents = onlineAgents.filter((agent) => !agent.paused);
  if (!enabledAgents.length) return 'All online desktop devices have new job assignment disabled.';

  if (!printers.length) return 'Desktop is online but no printer has synced to cloud. Refresh printers in PrintEase Desktop.';

  const enabledAgentIds = new Set(enabledAgents.map((agent) => agent.id));
  const printersForOnlineAgents = printers.filter((printer) => enabledAgentIds.has(printer.agentId));
  if (!printersForOnlineAgents.length) return 'Online desktop device has not synced any printers.';

  const unavailablePrinter = printersForOnlineAgents.find((printer) => !isRouteablePrinter(printer));
  if (unavailablePrinter) {
    const condition = getPrinterCondition(unavailablePrinter);
    return unavailablePrinter.warningText || `Printer ${unavailablePrinter.printerName || 'unknown'} is not available (${condition}).`;
  }

  return 'No available synced printer. Check heartbeat, printer sync, and Supabase agent_printers migration.';
}

export async function queuePrintJobIfPaymentReady(orderId, hubId, client) {
  const orderWithDocument = await findOrderWithDocumentForHub(orderId, hubId, client);

  if (!orderWithDocument) {
    return {
      queued: false,
      message: 'Order was not found for this hub.'
    };
  }

  const paymentStatus = normalize(orderWithDocument.payment_status);
  if (!PAYMENT_READY_STATUSES.has(paymentStatus)) {
    return {
      queued: false,
      blocked: 'PAYMENT_NOT_READY',
      message: 'Payment is not collected or verified yet. Desktop agent document access remains blocked.'
    };
  }

  const activeJob = await findActivePrintJobByOrder(orderId, hubId, client);
  if (activeJob) {
    return {
      queued: false,
      existingPrintJob: activeJob,
      message: paymentReadyMessage(paymentStatus, 'Existing print job found; no duplicate was created.')
    };
  }

  const storagePath = orderWithDocument.document_storage_path;
  const fileSha256 = orderWithDocument.document_file_sha256;
  const fileType = orderWithDocument.document_file_type || 'application/pdf';

  if (!storagePath || !fileSha256 || fileType !== 'application/pdf' || !isPrintableOrderStatus(orderWithDocument.status)) {
    return {
      queued: false,
      message: paymentReadyMessage(paymentStatus, 'Order is not ready for desktop PDF printing; hub can print manually.')
    };
  }

  const target = await findBestAvailableAgentPrinterForHub(hubId, client);
  if (!target?.agent || !target?.printer) {
    return {
      queued: false,
      message: paymentReadyMessage(paymentStatus, await describeNoAvailablePrinter(hubId, client))
    };
  }

  const printJob = await createPrintJob({
    id: generateId(),
    orderId,
    hubId,
    agentId: target.agent.id,
    printerName: target.printer.printerName,
    fileUrl: `private://${getSupabaseBucketName()}/${storagePath}`,
    fileSha256,
    fileType,
    copies: orderWithDocument.copies,
    paperSize: 'A4',
    colorMode: orderWithDocument.color_type || 'bw',
    sourceBackendUrl: OFFICIAL_BACKEND_URL
  }, client);

  await insertPrintJobEvent({
    printJobId: printJob.id,
    agentId: target.agent.id,
    eventType: 'queued_after_payment_ready',
    newStatus: 'queued',
    message: paymentReadyMessage(paymentStatus, 'Print job queued for desktop agent.'),
    rawStatus: {
      orderId,
      hubId,
      agentId: target.agent.id,
      printerName: target.printer.printerName,
      paymentStatus
    }
  }, client);

  const queuedOrder = await updateOrderStatus(orderId, hubId, 'Queued for Printing', client);

  return {
    queued: true,
    printJob,
    order: queuedOrder,
    message: paymentReadyMessage(paymentStatus, 'Print job queued for online desktop printer.')
  };
}
