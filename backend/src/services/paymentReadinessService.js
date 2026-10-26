import { listOrderFiles, findSettledPaymentForOrder } from '../db/repository.js';
import { isPaymentComplete } from './orderUtils.js';
import { getGuestPrintPageLimit, GUEST_PRINT_LIMIT_CODE } from './guestPrintLimitService.js';

function reject(message, code = 'BILL_NOT_READY') {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = code;
  throw error;
}

// Early downloads/conversions do not use this policy. Money and print activation
// require a complete bill for exactly the backend-verified printable files.
export function assertTrustedOrderBill(order, files, { online = false } = {}) {
  if (!order || ['cancelled', 'completed', 'printing'].includes(String(order.status).toLowerCase())) {
    reject('This order cannot start a new payment.');
  }
  if (order.priceSnapshot?.pricingPending || !files?.length) reject('Document preparation is still pending.');
  let lineTotal = 0;
  let printablePages = 0;
  for (const file of files) {
    const doc = file.document || {};
    const pageCount = Number(doc.preparedPageCount ?? doc.pageCount);
    const pdfReady = Boolean(doc.printReadyStoragePath && doc.printReadySha256) ||
      (doc.fileType === 'application/pdf' && Boolean(doc.storagePath && doc.fileSha256));
    if (doc.preparationStatus !== 'prepared' || !pdfReady || !Number.isInteger(pageCount) || pageCount <= 0) {
      reject('Wait for every document to finish preparation before requesting payment.');
    }
    // Zero is a valid free manual line, but missing/pending pricing is not zero.
    // Never infer a bill or page count from a browser-supplied display estimate.
    if (!Number.isSafeInteger(file.lineAmountPaise) || file.lineAmountPaise < 0) reject('A verified file price is missing.');
    if (!Number.isSafeInteger(file.printablePageCount) || file.printablePageCount <= 0) reject('Verified printable pages are missing.');
    lineTotal += file.lineAmountPaise;
    printablePages += file.printablePageCount;
  }
  const total = Number(order.totalAmountPaise);
  if (!Number.isSafeInteger(total) || total < 0 || total !== lineTotal || Math.round(Number(order.amount) * 100) !== total) {
    reject('The order bill changed or is incomplete. Refresh the order before paying.', 'BILL_AMOUNT_MISMATCH');
  }
  if (!order.userId && printablePages > getGuestPrintPageLimit()) {
    const error = new Error(`Login is required to print more than ${getGuestPrintPageLimit()} pages.`);
    error.statusCode = 403;
    error.code = GUEST_PRINT_LIMIT_CODE;
    throw error;
  }
  if (online && total === 0) reject('Online payment requires a positive amount.');
  return total;
}

export async function requireTrustedOrderBill(order, client, options) {
  const total = assertTrustedOrderBill(order, await listOrderFiles(order.id, client), options);
  if (!isPaymentComplete(order) && await findSettledPaymentForOrder(order.id, options?.settlingPaymentId, client)) {
    reject('A payment was already received and needs centre reconciliation. Do not pay again.', 'PAYMENT_RECONCILIATION_REQUIRED');
  }
  return total;
}

export function paymentBillSnapshot(order) {
  return { amountPaise: Number(order.totalAmountPaise), configVersion: Number(order.configVersion || 1) };
}

export function assertPaymentMatchesBill(payment, order) {
  // Bind each attempt to its saved amount/configuration. A correctly signed
  // payment for an older bill cannot authorize a newer, more expensive print.
  const snapshot = payment.providerPayload?.printeaseBill;
  if (Math.round(Number(payment.amount) * 100) !== Number(order.totalAmountPaise) ||
      (snapshot && (snapshot.amountPaise !== Number(order.totalAmountPaise) || snapshot.configVersion !== Number(order.configVersion || 1)))) {
    reject('Payment belongs to an older bill. Contact the centre to reconcile it.', 'PAYMENT_BILL_MISMATCH');
  }
}
