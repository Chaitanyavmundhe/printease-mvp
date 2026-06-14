import {
  findOrderByIdOrCode,
  listOrderFiles,
  findCentreById,
  withTransaction,
  createOrder as saveOrder,
  createOrderFile,
  findDocumentById
} from '../db/repository.js';
import { generateId, generateOrderCode, generateShortCode } from '../utils/generateCode.js';
import { calculatePrintPricing } from '../utils/calculatePrice.js';
import { pricingMetadata } from '../services/orderPricingPresenter.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';

function centreWithCurrentPricing(centre) {
  const pricing = centre?.pricing || {};
  return {
    ...centre,
    pricing: {
      bwSingle: pricing.bwSingle ?? centre?.bwSingle ?? 1,
      bwDouble: pricing.bwDouble ?? centre?.bwDouble ?? 1.5,
      colorSingle: pricing.colorSingle ?? centre?.colorSingle ?? 2,
      colorDouble: pricing.colorDouble ?? centre?.colorDouble ?? 3,
      watermarkCharge: pricing.watermarkCharge ?? centre?.watermarkCharge ?? 2,
    },
  };
}

function getOptionColorMode(printOptions = {}) {
  return printOptions.colorMode === 'color' || printOptions.color_mode === 'color' ? 'color' : 'bw';
}

function getOptionSideType(printOptions = {}) {
  const sides = String(printOptions.sides || printOptions.sideType || printOptions.side_type || '').toLowerCase();
  if (printOptions.duplex === true || sides === 'double' || sides.startsWith('two_sided')) return 'double';
  return 'single';
}

function getOptionPagesPerSheet(printOptions = {}) {
  return printOptions.pagesPerSheet || printOptions.pages_per_sheet || 1;
}

export async function canReprintOrder({ originalOrder, actor }) {
  if (!originalOrder) return false;
  
  if (actor.role === 'admin') return true;
  if (actor.role === 'user' && originalOrder.userId === actor.id) return true;
  if (actor.role === 'hub' && originalOrder.centreId === (actor.centreId || actor.hubId)) return true;
  
  return false;
}

export async function checkDocumentAvailability(document) {
  if (!document || !document.storagePath) return false;
  
  try {
    const supabase = getSupabaseAdminClient();
    const bucketName = getSupabaseBucketName();
    
    // We try to create a signed URL and do a HEAD request.
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(document.storagePath, 60);
      
    if (error || !data?.signedUrl) return false;
    
    const response = await fetch(data.signedUrl, { method: 'HEAD' });
    return response.ok;
  } catch (err) {
    console.error(`Check document availability failed for ${document.id}:`, err);
    return false;
  }
}

export async function createReprintOrder({ originalOrderId, actor, allowDocumentReuse }) {
  const originalOrder = await findOrderByIdOrCode(originalOrderId);
  if (!originalOrder) {
    throw new Error('Original order not found');
  }

  const hasAccess = await canReprintOrder({ originalOrder, actor });
  if (!hasAccess) {
    const error = new Error('Not authorized to reprint this order');
    error.statusCode = 403;
    throw error;
  }

  const originalFiles = await listOrderFiles(originalOrder.id);
  if (!originalFiles.length) {
    throw new Error('Original order has no files');
  }

  const centre = await findCentreById(originalOrder.centreId);
  if (!centre) {
    throw new Error('Original hub is no longer available');
  }
  const currentCentre = centreWithCurrentPricing(centre);

  let allDocumentsAvailable = true;
  const pricedFiles = [];

  for (const file of originalFiles) {
    if (!file.documentId) {
      allDocumentsAvailable = false;
      break;
    }
    const document = await findDocumentById(file.documentId);
    if (!document) {
      allDocumentsAvailable = false;
      break;
    }

    if (allowDocumentReuse) {
      const isAvailable = await checkDocumentAvailability(document);
      if (!isAvailable) {
        allDocumentsAvailable = false;
        break;
      }
    } else {
       allDocumentsAvailable = false;
       break;
    }

    // Re-price based on CURRENT hub pricing
    const price = calculatePrintPricing({
      centre: currentCentre,
      originalPageCount: file.originalPageCount,
      selectedPages: file.selectedPages,
      copies: file.copies,
      colorType: getOptionColorMode(file.printOptions),
      sideType: getOptionSideType(file.printOptions),
      paperSize: file.printOptions.paperSize || "A4",
      pagesPerSheet: getOptionPagesPerSheet(file.printOptions),
      watermarkEnabled: Boolean(file.printOptions.watermark?.enabled)
    });

    pricedFiles.push({
      originalFile: file,
      document,
      price,
      normalizedPrintOptions: {
        ...file.printOptions,
        pricing: pricingMetadata(price)
      }
    });
  }

  if (!allDocumentsAvailable) {
    // We cannot create the payable order automatically.
    // Return instructions to frontend to re-upload.
    return {
      success: false,
      nextAction: 'document_reupload_required',
      message: 'Original document is no longer available. Please upload it again to reprint.',
      prefill: {
        hubCode: centre.centreCode,
        documentName: originalOrder.documentName,
        files: originalFiles.map(f => ({
          printOptions: f.printOptions,
          originalPageCount: f.originalPageCount,
          copies: f.copies,
          selectedPages: f.selectedPages
        }))
      }
    };
  }

  // All documents exist. Create new pending order.
  const orderCode = generateOrderCode(centre.centreCode);
  const totalAmount = pricedFiles.reduce((sum, file) => sum + file.price.totalAmount, 0);
  const totalAmountPaise = pricedFiles.reduce((sum, file) => sum + file.price.totalAmountPaise, 0);
  
  const totalSelectedPages = pricedFiles.reduce((sum, file) => sum + file.price.selectedPageCount, 0);
  const totalPrintablePages = pricedFiles.reduce((sum, file) => sum + file.price.printablePageCount, 0);
  const totalSheetCount = pricedFiles.reduce((sum, file) => sum + file.price.sheetCount, 0);
  
  const firstFile = pricedFiles[0];
  const orderPrintOptions = pricedFiles.length === 1
    ? firstFile.normalizedPrintOptions
    : {
        files: pricedFiles.map((file, index) => ({
          documentId: file.document.id,
          printSequence: index + 1,
          printOptions: file.normalizedPrintOptions
        }))
      };

  const createdAt = new Date().toISOString();

  const result = await withTransaction(async (client) => {
    const order = await saveOrder({
      id: generateId(),
      orderCode,
      userId: actor?.id || null,
      customerType: originalOrder.customerType || 'registered',
      expiresAt: originalOrder.expiresAt || null,
      guestToken: originalOrder.guestToken || null,
      guestTokenHash: originalOrder.guestTokenHash || null,
      guestName: originalOrder.guestName || null,
      guestPhone: originalOrder.guestPhone || null,
      priceSnapshot: { amount: totalAmount, totalAmountPaise, breakdown: pricedFiles.map(f => f.price) },
      printConfigSnapshot: orderPrintOptions,
      centreId: centre.id,
      documentId: firstFile.document.id,
      documentName: originalOrder.documentName,
      pages: pricedFiles.length === 1 ? totalSelectedPages : totalPrintablePages,
      copies: pricedFiles.length === 1 ? firstFile.price.copies : 1,
      colorType: pricedFiles.length === 1 ? firstFile.price.colorMode : 'bw',
      sideType: pricedFiles.length === 1 ? firstFile.price.sides : 'single',
      watermarkEnabled: pricedFiles.some((file) => file.normalizedPrintOptions.watermark?.enabled),
      printOptions: orderPrintOptions,
      selectedPageCount: totalSelectedPages,
      printablePageCount: totalPrintablePages,
      sheetCount: totalSheetCount,
      amount: totalAmount,
      totalAmountPaise,
      paymentStatus: 'pending',
      status: 'Payment Pending',
      pickupCode: generateShortCode(4),
      createdAt
    }, client);

    // Update reprint columns manually as they might not be fully supported by `saveOrder` yet if repository.js isn't updated
    await client.query(`
      UPDATE print_orders 
      SET reprint_of_order_id = $1, 
          reprint_source = $2, 
          source_document_status = $3, 
          original_order_code_snapshot = $4
      WHERE id = $5
    `, [
      originalOrder.id,
      actor.role === 'user' ? 'user_reprint' : 'hub_reprint',
      'reused_existing_file',
      originalOrder.orderCode,
      order.id
    ]);

    const orderFiles = [];
    for (let index = 0; index < pricedFiles.length; index++) {
      const file = pricedFiles[index];
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
          printSequence: index + 1,
          createdAt
        }, client);
      orderFiles.push(orderFile);
    }

    return { order, orderFiles };
  });

  return {
    success: true,
    nextAction: 'payment_required',
    order: result.order,
    orderFiles: result.orderFiles
  };
}
