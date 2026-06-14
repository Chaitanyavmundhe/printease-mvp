import {
  createOrder as saveOrder,
  createOrderFile,
  cancelActivePrintJobsForOrder,
  findCentreByCode,
  findCentreById,
  createPayment as savePayment,
  findDocumentById,
  findOrderByIdOrCode,
  listOrderFiles,
  listOrdersByCentre,
  listOrdersByUser,
  updateOrderPayment,
  updateOrderStatus as saveOrderStatus,
  updateGuestDocumentsTokenHash,
  withTransaction
} from '../db/repository.js';
import { assertGuestCanUseDocument, getGuestTokenHashFromRequest, getGuestExpiry } from '../services/guestAccessService.js';
import { calculatePrintPricing } from '../utils/calculatePrice.js';
import { generateId, generateOrderCode, generateShortCode } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queuePrintJobIfPaymentReady } from '../services/printQueueService.js';
import { processManualCollection } from '../services/manualCollectionService.js';
import { createReprintOrder } from '../services/reprintOrderService.js';
import { buildSubmittedPrintOptions } from '../services/orderPrintOptionsService.js';
import { pricingMetadata } from '../services/orderPricingPresenter.js';
import {
  ALLOWED_HUB_ORDER_STATUSES,
  canAccessOrder,
  getOrderAccessToken,
  isCancelledOrder,
  isPaymentComplete
} from '../services/orderUtils.js';
import { assertGuestPrintLimit } from '../services/guestPrintLimitService.js';
import { assertCanUseDocumentForOrder } from '../services/orderDocumentAccessService.js';
import crypto from 'crypto';
import {
  normalizePrintOptions,
  toLegacyColorType,
  toLegacySideType
} from '../utils/printOptions.js';

function privateOrder(order) {
  return {
    ...order,
    pickupCode: order.pickupCode || null
  };
}

export const createOrder = asyncHandler(async (req, res) => {
  const {
    centreCode,
    hubId,
    documentId,
    documentIds,
    files,
    documentName,
    pages,
    selectedPages,
    copies = 1,
    colorType = 'bw',
    sideType = 'single',
    paperSize = 'A4',
    pagesPerSheet = 1,
    orientation = 'auto',
    printDpi = 300,
    scaleMode = 'original',
    marginMode = 'default',
    watermarkEnabled = false
  } = req.body;

  const trimmedCentreCode = typeof centreCode === 'string' ? centreCode.trim() : '';
  const copyCount = Number(copies);
  const allowedColorTypes = ['bw', 'color'];
  const allowedSideTypes = ['single', 'double'];

  if (!trimmedCentreCode && !hubId) {
    return res.status(400).json({ success: false, message: 'Centre code or hub ID is required' });
  }

  const submittedFiles = Array.isArray(files) && files.length
    ? files
    : Array.isArray(documentIds) && documentIds.length
      ? documentIds.map((id) => ({ documentId: id }))
      : [{ documentId, documentName, pages, selectedPages, copies, colorType, sideType, paperSize, pagesPerSheet, orientation, printDpi, scaleMode, marginMode, watermarkEnabled }];

  if (!submittedFiles.length) {
    return res.status(400).json({ success: false, message: 'At least one document and copies are required' });
  }

  const resolvedFiles = [];
  for (const [index, submittedFile] of submittedFiles.entries()) {
    const currentDocumentId = submittedFile.documentId || submittedFile.id;
    let document = null;

    if (currentDocumentId) {
      document = await findDocumentById(currentDocumentId);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: `Document ${index + 1} was not found. Please re-upload before payment.`
        });
      }
      
      try {
        assertCanUseDocumentForOrder({ user: req.user, document });
        if (!req.user?.id) {
          assertGuestCanUseDocument({ 
            guestTokenHash: getGuestTokenHashFromRequest(req), 
            document 
          });
        }
      } catch (error) {
        return res.status(error.statusCode || 403).json({ success: false, message: error.message });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: `Document ${index + 1} is missing an ID. Please upload it again before payment.`
      });
    }

    resolvedFiles.push({ ...submittedFile, document, index });
  }

  if (!Number.isFinite(copyCount) || copyCount <= 0) {
    return res.status(400).json({ success: false, message: 'Pages and copies must be positive numbers' });
  }

  if (!allowedColorTypes.includes(colorType) || !allowedSideTypes.includes(sideType)) {
    return res.status(400).json({ success: false, message: 'Invalid print options' });
  }

  const centre = hubId ? await findCentreById(hubId) : await findCentreByCode(trimmedCentreCode);
  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  const pricedFiles = [];
  try {
    for (const file of resolvedFiles) {
      if (file.document?.preparationStatus === 'pending') {
        const error = new Error('Document is being prepared for accurate page count.');
        error.statusCode = 400;
        throw error;
      }

      const trustedPageCount = file.document?.preparedPageCount ?? file.document?.pageCount ?? Number(file.pages ?? pages);

      if (!Number.isFinite(trustedPageCount) || trustedPageCount <= 0) {
        throw new Error('Each file must have a valid PDF page count');
      }

      const normalizedOptions = normalizePrintOptions(
        buildSubmittedPrintOptions(file, {
          selectedPages,
          copies,
          colorType,
          sideType,
          paperSize,
          pagesPerSheet,
          orientation,
          printDpi,
          scaleMode,
          marginMode,
          watermarkEnabled
        }),
        trustedPageCount
      );
      const fileColorType = toLegacyColorType(normalizedOptions.colorMode);
      const fileSideType = toLegacySideType(normalizedOptions.sides);
      const pricedSelectedPages = normalizedOptions.pages.mode === 'custom'
        ? normalizedOptions.pages.range
        : 'all';

      if (!allowedColorTypes.includes(fileColorType) || !allowedSideTypes.includes(fileSideType)) {
        throw new Error('Invalid print options');
      }

      const price = calculatePrintPricing({
        centre,
        originalPageCount: trustedPageCount,
        selectedPages: pricedSelectedPages,
        copies: normalizedOptions.copies,
        colorType: fileColorType,
        sideType: fileSideType,
        paperSize: normalizedOptions.paperSize,
        pagesPerSheet: normalizedOptions.pagesPerSheet,
        watermarkEnabled: normalizedOptions.watermark.enabled
      });

      pricedFiles.push({
        ...file,
        price,
        normalizedPrintOptions: {
          ...normalizedOptions,
          pricing: pricingMetadata(price)
        }
      });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Invalid page selection' });
  }

  const orderCode = generateOrderCode(centre.centreCode);
  const totalAmount = pricedFiles.reduce((sum, file) => sum + file.price.totalAmount, 0);
  const totalAmountPaise = pricedFiles.reduce((sum, file) => sum + file.price.totalAmountPaise, 0);
  const firstFile = pricedFiles[0];
  const totalSelectedPages = pricedFiles.reduce((sum, file) => sum + file.price.selectedPageCount, 0);
  const totalPrintablePages = pricedFiles.reduce((sum, file) => sum + file.price.printablePageCount, 0);
  const totalSheetCount = pricedFiles.reduce((sum, file) => sum + file.price.sheetCount, 0);
  const documentLabel = pricedFiles.length === 1
    ? documentName || firstFile.document?.fileName || 'Uploaded Document'
    : `${pricedFiles.length} uploaded documents`;
  const orderPrintOptions = pricedFiles.length === 1
    ? firstFile.normalizedPrintOptions
    : {
        files: pricedFiles.map((file) => ({
          documentId: file.document?.id || null,
          printSequence: file.index + 1,
          printOptions: file.normalizedPrintOptions
        }))
      };

  const createdAt = new Date().toISOString();
  const isLimitedLoginlessOrder = !req.user?.id;

  try {
    assertGuestPrintLimit({ user: req.user, pricedFiles });
  } catch (error) {
    return res.status(error.statusCode || 403).json({
      success: false,
      code: error.code,
      message: error.message,
      limit: error.limit,
      requestedPages: error.requestedPages
    });
  }

  const guestTokenHash = isLimitedLoginlessOrder ? getGuestTokenHashFromRequest(req) : null;
  const orderAccessToken = isLimitedLoginlessOrder ? getOrderAccessToken(req) : null;
  const expiresAt = isLimitedLoginlessOrder ? getGuestExpiry() : null;

  const result = await withTransaction(async (client) => {
    const order = await saveOrder({
      id: generateId(),
      orderCode,
      userId: req.user?.id || null,
      customerType: isLimitedLoginlessOrder ? 'guest' : 'registered',
      expiresAt,
      guestToken: null,
      guestTokenHash,
      guestName: null,
      guestPhone: null,
      priceSnapshot: { amount: totalAmount, totalAmountPaise, breakdown: pricedFiles.map(f => f.price) },
      printConfigSnapshot: orderPrintOptions,
      centreId: centre.id,
      documentId: firstFile.document?.id || null,
      documentName: documentLabel,
      pages: pricedFiles.length === 1 ? totalSelectedPages : totalPrintablePages,
      copies: pricedFiles.length === 1 ? firstFile.price.copies : 1,
      colorType: pricedFiles.length === 1 ? firstFile.price.colorMode : colorType,
      sideType: pricedFiles.length === 1 ? firstFile.price.sides : sideType,
      watermarkEnabled: pricedFiles.some((file) => file.normalizedPrintOptions.watermark.enabled),
      printOptions: orderPrintOptions,
      selectedPageCount: totalSelectedPages,
      printablePageCount: totalPrintablePages,
      sheetCount: totalSheetCount,
      amount: totalAmount,
      totalAmountPaise,
      paymentStatus: 'draft',
      status: 'Draft',
      pickupCode: generateShortCode(4),
      createdAt
    }, client);

    const orderFiles = [];
    for (const file of pricedFiles) {
      if (!file.document) continue;
      const price = file.price;
      const orderFile = await createOrderFile({
          id: generateId(),
          orderId: order.id,
          documentId: file.document.id,
          originalPageCount: price.originalPageCount,
          selectedPages: price.selectedPages,
          selectedPageCount: price.selectedPageCount,
          printablePageCount: price.printablePageCount,
          sheetCount: price.sheetCount,
          copies: price.copies,
          printOptions: file.normalizedPrintOptions,
          lineAmountPaise: price.totalAmountPaise,
          printSequence: file.index + 1,
          createdAt
        }, client);
      orderFiles.push(orderFile);
    }

    if (isLimitedLoginlessOrder && guestTokenHash) {
      const documentIds = pricedFiles.filter(f => f.document).map(f => f.document.id);
      if (documentIds.length > 0) {
        await updateGuestDocumentsTokenHash(documentIds, guestTokenHash, expiresAt, client);
      }
    }

    return { order, orderFiles };
  });

  const orderUrl = `${process.env.FRONTEND_URL}/track?order=${result.order.id}`;

  res.status(201).json({
    success: true,
    message: 'Order created. Complete payment before printing.',
    order: result.order,
    orderFiles: result.orderFiles,
    orderAccessToken,
    url: orderUrl,
    price: {
      totalAmount,
      totalAmountPaise,
      pricePerPage: firstFile.price.pricePerPage,
      files: pricedFiles.map((file) => ({
        documentId: file.document?.id || null,
        fileName: file.document?.fileName || file.documentName || documentName || 'Uploaded Document',
        ...file.price
      }))
    }
  });
});

export const getOrderDocuments = asyncHandler(async (req, res) => {
  const order = await findOrderByIdOrCode(req.params.orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const isAdmin = req.user?.role === 'admin';
  const isOwner = req.user?.role === 'user' && order.userId === req.user.id;
  const isHubOwner = req.user?.role === 'hub' && order.centreId === (req.user.centreId || req.user.hubId);

  if (!isAdmin && !isOwner && !isHubOwner) {
    return res.status(403).json({ success: false, message: 'You are not allowed to view documents for this order' });
  }

  const orderFiles = await listOrderFiles(order.id);
  res.json({
    success: true,
    orderId: order.id,
    orderCode: order.orderCode,
    documents: orderFiles.map((file) => ({
      id: file.id,
      orderId: file.orderId,
      documentId: file.documentId,
      fileName: file.document?.fileName,
      fileType: file.document?.fileType,
      fileSizeBytes: file.document?.fileSizeBytes,
      fileSha256: file.document?.fileSha256,
      pageCount: file.document?.pageCount,
      uploadedAt: file.document?.createdAt,
      originalPageCount: file.originalPageCount,
      selectedPages: file.selectedPages,
      selectedPageCount: file.selectedPageCount,
      printablePageCount: file.printablePageCount,
      sheetCount: file.sheetCount,
      copies: file.copies,
      printOptions: file.printOptions,
      amountPaise: file.amountPaise,
      printSequence: file.printSequence
    }))
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await findOrderByIdOrCode(req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (String(order.paymentStatus || '').toLowerCase() === 'draft' && !canAccessOrder(req.user, order, req)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (!canAccessOrder(req.user, order, req)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, order: privateOrder(order), public: false });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByUser(req.user.id);
  res.json({ success: true, orders });
});

export const getCentreOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByCentre(req.user.centreId || req.user.hubId);
  res.json({ success: true, orders });
});

export const collectCashPayment = asyncHandler(async (req, res) => {
  const result = await processManualCollection({
    orderId: req.params.id,
    hubId: req.user?.centreId || req.user?.hubId,
    rawMethod: req.body.method?.toLowerCase(),
    transactionNoteInput: req.body.transactionNote,
    autoPrintAfterCollection: req.body.autoPrintAfterCollection !== false
  });

  if (result.error === 'INVALID_METHOD') {
    return res.status(400).json({ success: false, message: result.message });
  }

  if (result?.notFound) {
    return res.status(404).json({ success: false, message: 'Order not found for this hub' });
  }

  if (result?.cancelledBeforePayment) {
    return res.status(409).json({
      success: false,
      message: 'Order was cancelled before payment. Cash collection is disabled.',
      order: result.order
    });
  }

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment collected.',
    ...result
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const hubId = req.user?.centreId || req.user?.hubId;
  const nextStatus = String(req.body.status || '').trim();

  if (!ALLOWED_HUB_ORDER_STATUSES.has(nextStatus)) {
    return res.status(400).json({ success: false, message: 'Unsupported order status' });
  }

  const result = await withTransaction(async (client) => {
    const existingOrder = await findOrderByIdOrCode(req.params.id, client);
    if (!existingOrder || existingOrder.centreId !== hubId) {
      return null;
    }

    const currentStatus = String(existingOrder.status || '').toLowerCase();
    const normalizedStatus = nextStatus.toLowerCase();

    // Do not allow changes if order is cancelled, unless un-cancelling (which we don't support)
    // Actually, let's keep it simple: can't change from Collected or Cancelled
    if (['collected', 'cancelled'].includes(currentStatus) && currentStatus !== normalizedStatus) {
      const error = new Error(`Cannot change status from ${existingOrder.status}`);
      error.statusCode = 400;
      throw error;
    }

    const order = await saveOrderStatus(existingOrder.id, hubId, nextStatus, client);
    if (!order) return null;

    const shouldStopPrintJobs = ['cancelled', 'paused', 'refund requested', 'printing failed'].includes(normalizedStatus);
    const cancelledPrintJobs = shouldStopPrintJobs
      ? await cancelActivePrintJobsForOrder(order.id, hubId, `Order marked ${nextStatus} by hub owner`, client)
      : [];

    return { order, cancelledPrintJobs };
  });

  if (!result) {
    return res.status(404).json({ success: false, message: 'Order not found for this centre' });
  }

  res.json({
    success: true,
    message: result.cancelledPrintJobs.length
      ? 'Order status updated and active print jobs stopped.'
      : 'Order status updated',
    order: result.order,
    cancelledPrintJobs: result.cancelledPrintJobs
  });
});

export const reprintOrder = asyncHandler(async (req, res) => {
  const allowDocumentReuse = req.body.allowDocumentReuse !== false;
  const result = await createReprintOrder({
    originalOrderId: req.params.id,
    actor: req.user,
    allowDocumentReuse
  });

  const statusCode = result.success ? 201 : 200;
  res.status(statusCode).json(result);
});
