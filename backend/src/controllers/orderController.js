import {
  createOrder as saveOrder,
  createOrderFile,
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
  withTransaction
} from '../db/repository.js';
import { calculatePrintPricing } from '../utils/calculatePrice.js';
import { generateId, generateOrderCode, generateShortCode } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { queuePrintJobIfPaymentReady } from '../services/printQueueService.js';

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
    watermarkEnabled = false
  } = req.body;

  const trimmedCentreCode = typeof centreCode === 'string' ? centreCode.trim() : '';
  const submittedPageCount = Number(pages);
  const copyCount = Number(copies);
  const normalizedPagesPerSheet = Number(pagesPerSheet);
  const allowedColorTypes = ['bw', 'color'];
  const allowedSideTypes = ['single', 'double'];
  const allowedPagesPerSheet = [1, 2, 4];

  if (!trimmedCentreCode && !hubId) {
    return res.status(400).json({ success: false, message: 'Centre code or hub ID is required' });
  }

  const submittedFiles = Array.isArray(files) && files.length
    ? files
    : Array.isArray(documentIds) && documentIds.length
      ? documentIds.map((id) => ({ documentId: id }))
      : [{ documentId, documentName, pages, selectedPages, copies, colorType, sideType, paperSize, pagesPerSheet, watermarkEnabled }];

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
        return res.status(404).json({ success: false, message: 'Uploaded document not found' });
      }

      if (
        document.userId &&
        req.user?.role !== 'hub' &&
        req.user?.role !== 'admin' &&
        document.userId !== req.user?.id
      ) {
        return res.status(403).json({ success: false, message: 'You are not allowed to use this uploaded document' });
      }
    }

    resolvedFiles.push({ ...submittedFile, document, index });
  }

  if (!Number.isFinite(copyCount) || copyCount <= 0) {
    return res.status(400).json({ success: false, message: 'Pages and copies must be positive numbers' });
  }

  if (!allowedColorTypes.includes(colorType) || !allowedSideTypes.includes(sideType) || !allowedPagesPerSheet.includes(normalizedPagesPerSheet)) {
    return res.status(400).json({ success: false, message: 'Invalid print options' });
  }

  const centre = hubId ? await findCentreById(hubId) : await findCentreByCode(trimmedCentreCode);
  if (!centre) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  const pricedFiles = [];
  try {
    for (const file of resolvedFiles) {
      const fileCopies = Number(file.copies ?? copies);
      const filePagesPerSheet = Number(file.pagesPerSheet ?? pagesPerSheet);
      const fileColorType = file.colorType ?? colorType;
      const fileSideType = file.sideType ?? sideType;
      const filePaperSize = file.paperSize ?? paperSize;
      const fileWatermark = file.watermarkEnabled ?? watermarkEnabled;
      const trustedPageCount = file.document?.pageCount || Number(file.pages ?? pages);

      if (!Number.isFinite(trustedPageCount) || trustedPageCount <= 0) {
        throw new Error('Each file must have a valid PDF page count');
      }

      if (!allowedColorTypes.includes(fileColorType) || !allowedSideTypes.includes(fileSideType) || !allowedPagesPerSheet.includes(filePagesPerSheet)) {
        throw new Error('Invalid print options');
      }

      const price = calculatePrintPricing({
        centre,
        originalPageCount: trustedPageCount,
        selectedPages: file.selectedPages ?? selectedPages,
        copies: fileCopies,
        colorType: fileColorType,
        sideType: fileSideType,
        paperSize: filePaperSize,
        pagesPerSheet: filePagesPerSheet,
        watermarkEnabled: fileWatermark
      });

      pricedFiles.push({ ...file, price });
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
  const documentLabel = pricedFiles.length === 1
    ? documentName || firstFile.document?.fileName || 'Uploaded Document'
    : `${pricedFiles.length} uploaded documents`;

  const createdAt = new Date().toISOString();

  const result = await withTransaction(async (client) => {
    const order = await saveOrder({
      id: generateId(),
      orderCode,
      userId: req.user?.id || null,
      centreId: centre.id,
      documentId: firstFile.document?.id || null,
      documentName: documentLabel,
      pages: pricedFiles.length === 1 ? totalSelectedPages : totalPrintablePages,
      copies: pricedFiles.length === 1 ? firstFile.price.copies : 1,
      colorType: pricedFiles.length === 1 ? firstFile.price.colorMode : colorType,
      sideType: pricedFiles.length === 1 ? firstFile.price.sides : sideType,
      watermarkEnabled: Boolean(watermarkEnabled),
      amount: totalAmount,
      totalAmountPaise,
      paymentStatus: 'pending',
      status: 'Payment Pending',
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
          printOptions: {
            color_mode: price.colorMode,
            paper_size: price.paperSize,
            sides: price.sides,
            pages_per_sheet: price.pagesPerSheet,
            physical_sheet_count: price.physicalSheetCount,
            charge_by: price.chargeBy,
            price_per_page: price.pricePerPage,
            price_per_sheet: price.pricePerSheet,
            watermark_enabled: Boolean(watermarkEnabled),
            watermark_fee: price.watermarkCharge,
            service_fee: price.serviceFee,
            total_amount: price.totalAmount
          },
          lineAmountPaise: price.totalAmountPaise,
          printSequence: file.index + 1,
          createdAt
        }, client);
      orderFiles.push(orderFile);
    }

    return { order, orderFiles };
  });

  res.status(201).json({
    success: true,
    message: 'Order created. Complete payment before printing.',
    order: result.order,
    orderFiles: result.orderFiles,
    price: {
      totalAmount,
      totalAmountPaise,
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

  res.json({ success: true, order });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByUser(req.user.id);
  res.json({ success: true, orders });
});

export const getCentreOrders = asyncHandler(async (req, res) => {
  const orders = await listOrdersByCentre(req.user.centreId);
  res.json({ success: true, orders });
});

export const collectCashPayment = asyncHandler(async (req, res) => {
  const hubId = req.user?.centreId || req.user?.hubId;
  const orderId = req.params.id;
  const collectionMethod = req.body.method === 'manual_upi' ? 'MANUAL_UPI' : 'CASH';
  const transactionNote = typeof req.body.transactionNote === 'string' ? req.body.transactionNote.trim().slice(0, 200) : '';

  const result = await withTransaction(async (client) => {
    const order = await findOrderByIdOrCode(orderId, client);

    if (!order || order.centreId !== hubId) {
      return { notFound: true };
    }

    const normalizedPaymentStatus = String(order.paymentStatus || '').toLowerCase();
    if (!['pending', 'unpaid', ''].includes(normalizedPaymentStatus)) {
      const autoQueue = await queuePrintJobIfPaymentReady(order.id, hubId, client);
      return {
        order,
        payment: null,
        autoQueue,
        printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
      };
    }

    const now = new Date().toISOString();
    const payment = await savePayment({
      id: generateId(),
      orderId: order.id,
      amount: order.amount,
      method: collectionMethod,
      transactionId: transactionNote || `${collectionMethod.toLowerCase()}_collected_${Date.now()}`,
      status: 'collected',
      createdAt: now,
      verifiedAt: now
    }, client);

    const collectedOrder = await updateOrderPayment(order.id, 'collected', 'Payment Collected', client);
    const autoQueue = await queuePrintJobIfPaymentReady(collectedOrder.id, hubId, client);

    return {
      payment,
      order: autoQueue.order || collectedOrder,
      autoQueue,
      printJob: autoQueue.printJob || autoQueue.existingPrintJob || null
    };
  });

  if (result?.notFound) {
    return res.status(404).json({ success: false, message: 'Order not found for this hub' });
  }

  res.json({
    success: true,
    message: result.autoQueue?.message || 'Payment collected.',
    ...result
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await saveOrderStatus(req.params.id, req.user.centreId, req.body.status);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found for this centre' });
  }

  res.json({ success: true, message: 'Order status updated', order });
});
