import {
  createPrintJob,
  createPayment as savePayment,
  findActivePrintJobByOrder,
  findBestAvailableAgentPrinterForHub,
  findOrderByIdOrCode,
  findOrderWithDocumentForHub,
  findPaymentById,
  insertPrintJobEvent,
  updateOrderPayment,
  updateOrderStatus,
  updatePayment,
  withTransaction
} from '../db/repository.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { getSupabaseBucketName } from '../config/supabase.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'user') return order.userId === user.id;
  if (user.role === 'hub') return Boolean(user.centreId && order.centreId === user.centreId);
  return false;
}

function isPrintableOrderStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return !['printing', 'ready for pickup', 'collected', 'printing failed'].includes(normalized);
}

async function autoQueuePrintJobAfterPayment(order, client) {
  const hubId = order.centreId;
  const orderWithDocument = await findOrderWithDocumentForHub(order.id, hubId, client);

  if (!orderWithDocument) {
    return {
      queued: false,
      message: 'Payment verified. Hub can print manually.'
    };
  }

  const activeJob = await findActivePrintJobByOrder(order.id, hubId, client);
  if (activeJob) {
    return {
      queued: false,
      existingPrintJob: activeJob,
      message: 'Payment verified. Existing print job found; no duplicate was created.'
    };
  }

  const storagePath = orderWithDocument.document_storage_path;
  const fileSha256 = orderWithDocument.document_file_sha256;
  const fileType = orderWithDocument.document_file_type || 'application/pdf';

  if (!storagePath || !fileSha256 || fileType !== 'application/pdf' || !isPrintableOrderStatus(orderWithDocument.status)) {
    return {
      queued: false,
      message: 'Payment verified. Order is not ready for desktop PDF printing; hub can print manually.'
    };
  }

  const target = await findBestAvailableAgentPrinterForHub(hubId, client);
  if (!target?.agent || !target?.printer) {
    return {
      queued: false,
      message: 'Payment verified. No online desktop printer available; hub can print manually.'
    };
  }

  const printJob = await createPrintJob({
    id: generateId(),
    orderId: order.id,
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
    eventType: 'auto_queued_after_payment',
    newStatus: 'queued',
    message: 'Payment verified and job auto-queued for desktop agent',
    rawStatus: {
      orderId: order.id,
      hubId,
      agentId: target.agent.id,
      printerName: target.printer.printerName
    }
  }, client);

  const queuedOrder = await updateOrderStatus(order.id, hubId, 'Queued for Printing', client);

  return {
    queued: true,
    printJob,
    order: queuedOrder,
    message: 'Payment verified. Print job queued for online desktop printer.'
  };
}

export const createPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'Order ID is required' });
  }

  const order = await findOrderByIdOrCode(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to create payment for this order' });
  }

  const payment = await savePayment({
    id: generateId(),
    orderId: order.id,
    amount: order.amount,
    method: 'DEMO_UPI',
    transactionId: `demo_order_${Date.now()}`,
    status: 'created',
    createdAt: new Date().toISOString(),
    verifiedAt: null
  });

  res.status(201).json({
    success: true,
    message: 'Demo payment order created',
    payment,
    note: 'Production should create Razorpay order from backend.'
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId, demoSuccess = true } = req.body;

  if (!paymentId) {
    return res.status(400).json({ success: false, message: 'Payment ID is required' });
  }

  const payment = await findPaymentById(paymentId);

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  const order = await findOrderByIdOrCode(payment.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Linked order not found' });
  }

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You are not allowed to verify this payment' });
  }

  if (!demoSuccess) {
    const result = await withTransaction(async (client) => {
      const failedPayment = await updatePayment(payment.id, { status: 'failed' }, client);
      const failedOrder = await updateOrderPayment(order.id, 'failed', 'Payment Failed', client);
      return { payment: failedPayment, order: failedOrder };
    });

    return res.json({ success: true, message: 'Payment marked failed in demo', ...result });
  }

  const result = await withTransaction(async (client) => {
    const verifiedPayment = await updatePayment(payment.id, {
      status: 'verified',
      transactionId: `demo_payment_${Date.now()}`,
      verifiedAt: new Date().toISOString()
    }, client);
    const verifiedOrder = await updateOrderPayment(order.id, 'verified', 'Payment Verified', client);
    const autoQueue = await autoQueuePrintJobAfterPayment(verifiedOrder, client);
    return {
      payment: verifiedPayment,
      order: autoQueue.order || verifiedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment verified in demo mode',
    ...result,
    securityNote: 'Real project must verify Razorpay signature/webhook on backend.'
  });
});
