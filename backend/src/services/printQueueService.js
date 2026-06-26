import {
  createPrintJob,
  findActivePrintJobByOrder,
  findBestAgentForHub,
  findOrderWithDocumentForHub,
  findPreferredPrinterHintForAgent,
  insertPrintJobEvent,
  listOrderFiles,
  updateOrderStatus
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { getSupabaseBucketName } from '../config/supabase.js';
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

  const { firstFile, storagePath, fileSha256, fileType } = readiness;

  const targetAgent = await findBestAgentForHub(hubId, client);
  const printerHint = targetAgent
    ? await findPreferredPrinterHintForAgent(targetAgent.id, client)
    : null;
  const firstPrintReadyFile = await getPrintReadyFile({
    id: orderId,
    orderCode: orderWithDocument.order_code,
    pickupCode: orderWithDocument.pickup_code
  }, firstFile);

  const printJob = await createPrintJob({
    id: generateId(),
    orderId,
    hubId,
    agentId: targetAgent?.id || null,
    printerName: printerHint || null,
    fileUrl: firstPrintReadyFile?.fileUrl || `private://${getSupabaseBucketName()}/${storagePath}`,
    fileSha256: firstPrintReadyFile?.fileSha256 || fileSha256,
    fileType: firstPrintReadyFile?.fileType || fileType,
    copies: firstFile.copies || orderWithDocument.copies,
    paperSize: firstFile.printOptions?.paperSize || 'A4',
    colorMode: firstFile.printOptions?.colorMode || orderWithDocument.color_type || 'bw',
    printOptions: optionsForDeliveredPdf(firstFile.printOptions || orderWithDocument.print_options || {}, firstPrintReadyFile?.transformed),
    sourceBackendUrl: OFFICIAL_BACKEND_URL
  }, client);

  // Phase 10: Populate new multi-file execution table in the background
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
