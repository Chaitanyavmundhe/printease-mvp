import { getUserPrintHistory, getUserPrintHistoryCompact, getOrderForUser, getOrderConfigEvents } from '../db/repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function labelPaymentMethod(payment, order) {
  const method = String(payment?.method || payment?.provider || '').toUpperCase();
  if (method.includes('RAZORPAY')) return method.includes('QR') ? 'Razorpay UPI QR' : 'Razorpay';
  if (method.includes('UPI')) return 'Manual UPI';
  if (method.includes('CASH')) return 'Manual Cash';
  if (normalizeStatus(order?.paymentStatus) === 'collected') return 'Manual Cash';
  return method ? method.replace(/_/g, ' ') : 'Not selected';
}

function labelPaymentStatus(order, payment) {
  const status = normalizeStatus(payment?.status || order?.paymentStatus);
  if (['verified', 'collected', 'paid', 'captured', 'authorized'].includes(status)) return 'Paid';
  if (['failed'].includes(status)) return 'Failed';
  if (['refunded', 'refund_requested'].includes(status)) return 'Refunded';
  if (['draft'].includes(status)) return 'Draft';
  return 'Pending';
}

function buildPrintConfig(order, files) {
  const firstOptions = files[0]?.printOptions || order.printOptions || {};
  const snapshot = order.printConfigSnapshot || firstOptions || {};
  const source = snapshot.files?.[0]?.printOptions || snapshot;
  const sides = source.sides || order.sideType;

  return {
    color_mode: source.colorMode || (order.colorType === 'color' ? 'color' : 'black_white'),
    paper_size: source.paperSize || 'A4',
    orientation: source.orientation || 'auto',
    duplex: sides === 'two_sided_long_edge' || sides === 'double',
    sides: sides === 'two_sided_long_edge' || sides === 'double' ? 'Double-sided' : 'Single-sided',
    copies: Number(source.copies || order.copies || 1),
    page_range: source.pages?.mode === 'custom' ? source.pages.range : files[0]?.selectedPages || 'all',
    scaling: source.scale?.mode || 'original',
    fit_to_page: source.scale?.mode === 'fit',
    collate: source.collate ?? true,
    pages_per_sheet: Number(source.pagesPerSheet || 1),
    margins: source.margins?.mode || 'default',
    quality_dpi: Number(source.quality?.dpi || 300),
    watermark: source.watermark || { enabled: Boolean(order.watermarkEnabled) },
    raw: snapshot
  };
}

function buildDocuments(order, files) {
  if (!files.length) {
    return [{
      document_id: order.documentId,
      file_name: order.documentName || 'Document',
      file_type: 'application/pdf',
      original_pages: order.documentPageCount || order.pages || 0,
      page_range: order.selectedPageCount ? 'custom' : 'all',
      printable_pages: order.printablePageCount || order.pages || 0,
      copies: order.copies || 1,
      charged_pages: order.sheetCount || order.printablePageCount || order.pages || 0,
      print_options: order.printOptions || {}
    }];
  }

  return files.map((file) => ({
    id: file.id,
    document_id: file.documentId,
    file_name: file.document?.fileName || order.documentName || 'Document',
    file_type: file.document?.fileType || 'application/pdf',
    original_pages: file.originalPageCount,
    page_range: file.selectedPages || 'all',
    printable_pages: file.printablePageCount,
    copies: file.copies,
    charged_pages: file.sheetCount,
    amount_paise: file.amountPaise,
    print_sequence: file.printSequence,
    print_options: file.printOptions || {},
    preparation_status: file.document?.preparationStatus,
    preparation_error_message: file.document?.preparationErrorMessage
  }));
}

function addTimelineItem(items, label, time, type = null) {
  if (!time) return;
  items.push({ label, time, type });
}

function buildTimeline(order, payment, printJobs, configEvents = []) {
  const items = [];
  addTimelineItem(items, 'Order created', order.createdAt, 'order_created');
  addTimelineItem(
    items,
    normalizeStatus(order.paymentStatus) === 'collected' ? 'Manual payment collected' : 'Payment completed',
    payment?.verifiedAt,
    'payment_completed'
  );

  for (const event of configEvents) {
    const actorLabel = event.actorRole === 'hub' ? 'Shopkeeper' : 'Customer';
    const notePart = event.note ? ` (${event.note})` : '';
    addTimelineItem(
      items,
      `${actorLabel} adjusted options (v${order.configVersion || 1})${notePart}`,
      event.createdAt,
      'config_override'
    );
  }

  for (const job of printJobs) {
    addTimelineItem(items, 'Ready to print', job.createdAt, 'print_job_created');
    addTimelineItem(items, 'Printing accepted by desktop agent', job.acceptedAt, 'print_accepted');
    addTimelineItem(items, 'Printing started', job.printingStartedAt, 'printing_started');
    addTimelineItem(items, 'Printed successfully', job.completedAt, 'printed');
    addTimelineItem(items, job.failureReasonText || 'Print failed/cancelled', job.failedAt, 'print_failed');
  }

  if (normalizeStatus(order.status) === 'cancelled') {
    addTimelineItem(items, 'Order cancelled', order.createdAt, 'cancelled');
  }

  return items.sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
}

/**
 * Compact representation for the history list.
 * Only includes fields needed to render the list card row.
 * No documents array, no print_config, no timeline, no raw snapshots.
 */
function toCompactOrder(order, payment) {
  return {
    id: order.id,
    order_code: order.order_code,
    created_at: order.created_at,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: payment ? labelPaymentMethod(payment, { paymentStatus: order.payment_status }) : labelPaymentMethod(null, { paymentStatus: order.payment_status }),
    amount: order.amount,
    pages: order.pages,
    copies: order.copies,
    document_name: order.document_name || null,
    hub: order.hub
  };
}

function toHistoryOrder(order, files, payment, printJobs, configEvents = []) {
  const documents = buildDocuments(order, files);
  const printConfig = buildPrintConfig(order, files);
  const primaryDocument = documents[0] || {};
  const paidAt = payment?.verifiedAt || null;
  const latestPrintJob = printJobs[0] || null;

  return {
    id: order.id,
    order_code: order.orderCode,
    created_at: order.createdAt,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_method: labelPaymentMethod(payment, order),
    amount: order.amount,
    total_amount_paise: order.totalAmountPaise,
    pages: order.pages,
    copies: order.copies,
    hub: order.hub,
    document: primaryDocument,
    documents,
    print_config: printConfig,
    price_breakdown: order.priceSnapshot || printConfig.raw?.pricing || null,
    payment: {
      id: payment?.id || null,
      method: labelPaymentMethod(payment, order),
      status: labelPaymentStatus(order, payment),
      amount: payment?.amount ?? order.amount,
      transaction_id: payment?.transactionId || payment?.providerPaymentId || payment?.providerOrderId || null,
      paid_at: paidAt,
      created_at: payment?.createdAt || null,
      provider: payment?.provider || null
    },
    print_job: latestPrintJob
      ? {
          id: latestPrintJob.id,
          agent_id: latestPrintJob.agentId,
          printer_name: latestPrintJob.printerName,
          status: latestPrintJob.status,
          created_at: latestPrintJob.createdAt,
          completed_at: latestPrintJob.completedAt,
          failed_at: latestPrintJob.failedAt
        }
      : null,
    timeline: buildTimeline(order, payment, printJobs, configEvents)
  };
}

export const getUserHistory = asyncHandler(async (req, res) => {
  const compact = req.query.compact === 'true';
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

  if (compact) {
    // Compact mode: single SQL query, no sub-queries for files/payments/printjobs
    const orders = await getUserPrintHistoryCompact(req.user.id, limit);

    const paidOrders = orders.filter((o) => ['collected', 'verified', 'paid', 'captured'].includes(
      String(o.payment_status || '').toLowerCase()
    ));
    const totalPages = orders.reduce((sum, o) => {
      const pages = o.printable_page_count != null
        ? Number(o.printable_page_count)
        : Number(o.pages || 0) * Number(o.copies || 1);
      return sum + pages;
    }, 0);

    res.set('Cache-Control', 'private, max-age=60');
    return res.json({
      success: true,
      compact: true,
      summary: {
        total_orders: orders.length,
        total_pages_printed: totalPages,
        total_amount_spent: paidOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0),
        last_print_date: orders[0]?.created_at || null
      },
      orders
    });
  }

  // Full mode — backward-compatible, returns existing payload shape
  const { orders, filesByOrderId, paymentsByOrderId, printJobsByOrderId } = await getUserPrintHistory(req.user.id);
  const historyOrders = orders.map((order) => toHistoryOrder(
    order,
    filesByOrderId.get(order.id) || [],
    paymentsByOrderId.get(order.id) || null,
    printJobsByOrderId.get(order.id) || []
  ));

  const paidOrders = historyOrders.filter((order) => ['Paid', 'Refunded'].includes(order.payment.status));
  const totalPages = historyOrders.reduce((sum, order) => {
    const documentPages = order.documents.reduce((fileSum, file) => fileSum + Number(file.printable_pages || 0) * Number(file.copies || 1), 0);
    return sum + (documentPages || Number(order.pages || 0) * Number(order.copies || 1));
  }, 0);

  res.set('Cache-Control', 'private, max-age=60');
  res.json({
    success: true,
    summary: {
      total_orders: historyOrders.length,
      total_pages_printed: totalPages,
      total_amount_spent: paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      last_print_date: historyOrders[0]?.created_at || null
    },
    orders: historyOrders
  });
});

/**
 * GET /api/user/history/:orderId
 * Returns full detail for a single order owned by the authenticated user.
 * Used for lazy loading when the user clicks "View Details".
 */
export const getOrderDetail = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!orderId || !UUID_RE.test(orderId)) {
    return res.status(400).json({ success: false, error: 'Invalid order ID' });
  }

  const result = await getOrderForUser(orderId, req.user.id);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const { order, files, payment, printJobs } = result;
  const configEvents = await getOrderConfigEvents(order.id);
  const detail = toHistoryOrder(order, files, payment, printJobs, configEvents);

  res.set('Cache-Control', 'private, max-age=300');
  res.json({ success: true, order: detail });
});
