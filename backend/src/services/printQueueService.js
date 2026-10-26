import {
  createPrintJob,
  findActivePrintJobByOrder,
  findBestAgentForHub,
  findOrderWithDocumentForHub,
  findOrderByIdOrCode,
  findPreferredPrinterHintForAgent,
  insertPrintJobEvent,
  listOrderFiles,
  updateOrderStatus,
  withTransaction
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { generateId } from '../utils/generateCode.js';
import { getAgentLiveStatus, getPrinterCondition } from '../utils/hubAgentAnalytics.js';
import { getPrintReadyFile } from '../utils/printReadyPdf.js';

const PAYMENT_READY_STATUSES = new Set(['verified', 'collected']);

import {
  normalize,
  paymentReadyMessage,
  optionsForDeliveredPdf,
  verifyPrintFilesReadiness
} from './printJobReadinessService.js';
import { createPrintJobFilesForOrder } from './printQueue/printJobFilesService.js';
import { PRINT_JOB_STATUSES } from '../constants/statuses.js';
import { requireTrustedOrderBill } from './paymentReadinessService.js';

export async function queuePrintJobIfPaymentReady(orderId, hubId, client, target = {}) {
  // One activation gate for automatic payment handling and manual Send. Check
  // for existing work under the order lock; early download never calls this gate.
  if (!client) return withTransaction(transaction => queuePrintJobIfPaymentReady(orderId, hubId, transaction, target));
  const lockedOrder = await findOrderByIdOrCode(orderId, client, { forUpdate: true });
  if (!lockedOrder || lockedOrder.centreId !== hubId) return { queued: false, blocked: 'ORDER_NOT_FOUND' };
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
      message: 'Payment is not collected yet. Desktop agent document access remains blocked.'
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

  const orderFiles = await listOrderFiles(orderId, client);
  const readiness = verifyPrintFilesReadiness(orderFiles, orderWithDocument);

  if (!readiness.isReady) {
    return {
      queued: false,
      message: paymentReadyMessage(paymentStatus, 'Order is not ready for desktop PDF printing; hub can print manually.')
    };
  }

  await requireTrustedOrderBill(lockedOrder, client);

  const { firstFile, fileSha256 } = readiness;

  const targetAgent = target.agent || await findBestAgentForHub(hubId, client);
  const printerHint = target.printerName || (targetAgent
    ? await findPreferredPrinterHintForAgent(targetAgent.id, client)
    : null);
  const firstPrintReadyFile = await getPrintReadyFile({
    id: orderId,
    orderCode: orderWithDocument.order_code,
    pickupCode: orderWithDocument.pickup_code
  }, firstFile);

  if (!firstPrintReadyFile?.fileUrl || firstPrintReadyFile.fileType !== 'application/pdf') {
    return {
      queued: false,
      blocked: 'PRINT_READY_PDF_REQUIRED',
      message: paymentReadyMessage(paymentStatus, 'Order is waiting for a verified PDF before desktop printing.')
    };
  }

  const printJob = await createPrintJob({
    id: generateId(),
    orderId,
    hubId,
    agentId: targetAgent?.id || null,
    printerName: printerHint || null,
    fileUrl: firstPrintReadyFile.fileUrl,
    fileSha256: firstPrintReadyFile.fileSha256 || fileSha256,
    fileType: firstPrintReadyFile.fileType,
    copies: firstFile.copies || orderWithDocument.copies,
    paperSize: firstFile.printOptions?.paperSize || 'A4',
    colorMode: firstFile.printOptions?.colorMode || orderWithDocument.color_type || 'bw',
    printOptions: optionsForDeliveredPdf(firstFile.printOptions || orderWithDocument.print_options || {}, firstPrintReadyFile?.transformed),
    sourceBackendUrl: OFFICIAL_BACKEND_URL
  }, client);

  // Persist every file in this transaction; job creation must not commit only
  // the first document while the desktop expects a complete multi-file payload.
  await createPrintJobFilesForOrder({
    printJobId: printJob.id,
    orderFiles,
    client
  });

  await insertPrintJobEvent({
    printJobId: printJob.id,
    agentId: targetAgent?.id || null,
    eventType: 'queued_after_payment_ready',
    newStatus: PRINT_JOB_STATUSES.QUEUED,
    message: paymentReadyMessage(
      paymentStatus,
      targetAgent
        ? 'Print job queued for desktop agent.'
        : 'Queued. Waiting for PrintEase Desktop agent.'
    ),
    rawStatus: {
      orderId,
      hubId,
      agentId: targetAgent?.id || null,
      printerName: printerHint || null,
      paymentStatus
    }
  }, client);

  const queuedOrder = await updateOrderStatus(orderId, hubId, 'queued_for_print', client);

  return {
    queued: true,
    printJob,
    order: queuedOrder,
    message: paymentReadyMessage(
      paymentStatus,
      targetAgent
        ? 'Print job queued for desktop agent.'
        : 'Print job queued. Open PrintEase Desktop to process it.'
    )
  };
}
