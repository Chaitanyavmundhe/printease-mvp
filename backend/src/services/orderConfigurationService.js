import {
  findOrderByIdOrCode,
  findCentreById,
  listOrderFiles,
  updateOrderFileConfiguration,
  updateOrderConfiguration,
  createOrderConfigEvent,
  executor,
  withTransaction,
  findOrderIdsByDocumentId
} from '../db/repository.js';
import { calculatePrintPricing } from '../utils/calculatePrice.js';
import { normalizePrintOptions, toLegacyColorType, toLegacySideType } from '../utils/printOptions.js';
import crypto from 'crypto';

/**
 * Checks whether the print hub is allowed to configure/correct settings for a given order.
 */
export async function canHubConfigureManualOrder({ order, hubId, client }) {
  if (!order) {
    return { eligible: false, reason: 'Order not found' };
  }
  if (order.centreId !== hubId) {
    return { eligible: false, reason: 'Order does not belong to this hub' };
  }

  // Payment must be manual (payment_status is 'draft', 'pending', or 'collected')
  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  if (!['draft', 'pending', 'collected'].includes(paymentStatus)) {
    return { eligible: false, reason: 'Only manual payment orders can be configured' };
  }

  // Status must not be cancelled, completed, or printed/printing
  const status = String(order.status || '').toLowerCase();
  if (['cancelled', 'completed', 'printed', 'printing'].includes(status)) {
    return { eligible: false, reason: `Order is already in ${status} state` };
  }

  // Configuration must not be locked
  if (order.configLockedAt) {
    return { eligible: false, reason: order.configLockReason || 'Order configuration is locked' };
  }

  // Check if any print jobs have already been generated for this order
  const printJobsResult = await executor(client).query(
    `select count(*) as count from print_jobs where order_id = $1`,
    [order.id]
  );
  const hasPrintJobs = parseInt(printJobsResult.rows[0].count, 10) > 0;
  if (hasPrintJobs) {
    return { eligible: false, reason: 'Cannot configure order after print jobs are generated' };
  }

  return { eligible: true };
}

/**
 * Applies a manual print configuration override to the files in an order,
 * recalculating pricing and generating an audit trail.
 */
export async function applyOrderConfigurationChange({ orderId, hubId, actor, newFilesConfig, note }) {
  return await withTransaction(async (client) => {
    const order = await findOrderByIdOrCode(orderId, client);
    if (!order) {
      throw new Error('Order not found');
    }

    const eligibility = await canHubConfigureManualOrder({ order, hubId, client });
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    const centre = await findCentreById(hubId, client);
    if (!centre) {
      throw new Error('Hub profile not found');
    }

    const existingFiles = await listOrderFiles(order.id, client);
    if (!existingFiles || existingFiles.length === 0) {
      throw new Error('No files found for this order');
    }

    const existingFileIds = new Set(existingFiles.map((file) => String(file.id)));
    const requestedFileIds = new Set();

    for (const fileConfig of newFilesConfig || []) {
      if (!fileConfig || typeof fileConfig !== 'object') {
        throw new Error('Each file configuration must be an object');
      }

      const fileId = String(fileConfig.id || '').trim();
      if (!fileId) {
        throw new Error('Each file configuration must include a file id');
      }

      if (requestedFileIds.has(fileId)) {
        throw new Error(`Duplicate file configuration submitted for ${fileId}`);
      }

      if (!existingFileIds.has(fileId)) {
        throw new Error(`File ${fileId} does not belong to this order`);
      }

      requestedFileIds.add(fileId);
    }

    // Save previous snapshot of options/price for audit log
    const previousConfig = order.printConfigSnapshot || order.printOptions;
    const previousPriceSnapshot = order.priceSnapshot;
    const previousAmountPaise = order.totalAmountPaise;

    const pricedFiles = [];

    for (let index = 0; index < existingFiles.length; index++) {
      const existingFile = existingFiles[index];
      // Find update in newFilesConfig by file ID
      const update = (newFilesConfig || []).find(f => f.id === existingFile.id);
      
      let mergedPrintOptions = existingFile.printOptions;
      let copies = existingFile.copies;
      
      if (update) {
        if (update.copies !== undefined) {
          copies = update.copies;
        }
        if (update.printOptions && typeof update.printOptions === 'object') {
          // Deep merge the incoming options with existing options
          mergedPrintOptions = {
            ...existingFile.printOptions,
            ...update.printOptions,
            pages: {
              ...(existingFile.printOptions?.pages || {}),
              ...(update.printOptions.pages || {})
            },
            scale: {
              ...(existingFile.printOptions?.scale || {}),
              ...(update.printOptions.scale || {})
            },
            margins: {
              ...(existingFile.printOptions?.margins || {}),
              ...(update.printOptions.margins || {})
            },
            quality: {
              ...(existingFile.printOptions?.quality || {}),
              ...(update.printOptions.quality || {})
            },
            watermark: {
              ...(existingFile.printOptions?.watermark || {}),
              ...(update.printOptions.watermark || {})
            }
          };
        }
      }

      // Normalize print options using existing utility
      const normalizedOptions = normalizePrintOptions(mergedPrintOptions, existingFile.originalPageCount);
      normalizedOptions.copies = copies; // Keep inline with copies field
      
      // Convert normalized modes back to legacy types for the pricing calculator
      const fileColorType = toLegacyColorType(normalizedOptions.colorMode);
      const fileSideType = toLegacySideType(normalizedOptions.sides);
      const pricedSelectedPages = normalizedOptions.pages.mode === 'custom'
        ? normalizedOptions.pages.range
        : 'all';

      const price = calculatePrintPricing({
        centre,
        originalPageCount: existingFile.originalPageCount,
        selectedPages: pricedSelectedPages,
        copies: copies,
        colorType: fileColorType,
        sideType: fileSideType,
        paperSize: normalizedOptions.paperSize,
        pagesPerSheet: normalizedOptions.pagesPerSheet,
        watermarkEnabled: normalizedOptions.watermark.enabled
      });

      // Persist the individual file settings
      const updatedFile = await updateOrderFileConfiguration(existingFile.id, {
        copies: price.copies,
        selectedPages: price.selectedPages,
        selectedPageCount: price.selectedPageCount,
        printablePageCount: price.printablePageCount,
        sheetCount: price.sheetCount,
        printOptions: normalizedOptions,
        lineAmountPaise: price.totalAmountPaise
      }, client);

      pricedFiles.push({
        id: existingFile.id,
        printSequence: existingFile.printSequence || (index + 1),
        price,
        normalizedPrintOptions: normalizedOptions,
        updatedFile
      });
    }

    // Aggregate statistics across files to update the parent order
    const totalAmount = pricedFiles.reduce((sum, f) => sum + f.price.totalAmount, 0);
    const totalAmountPaise = pricedFiles.reduce((sum, f) => sum + f.price.totalAmountPaise, 0);
    const totalSelectedPages = pricedFiles.reduce((sum, f) => sum + f.price.selectedPageCount, 0);
    const totalPrintablePages = pricedFiles.reduce((sum, f) => sum + f.price.printablePageCount, 0);
    const totalSheetCount = pricedFiles.reduce((sum, f) => sum + f.price.sheetCount, 0);

    const firstFile = pricedFiles[0];
    const orderPrintOptions = pricedFiles.length === 1
      ? firstFile.normalizedPrintOptions
      : {
          files: pricedFiles.map((f) => ({
            documentId: f.updatedFile.documentId,
            printSequence: f.printSequence,
            printOptions: f.normalizedPrintOptions
          }))
        };

    const newPriceSnapshot = {
      amount: totalAmount,
      totalAmountPaise,
      breakdown: pricedFiles.map(f => f.price)
    };

    // Update parent print order configuration version and audit metadata
    const updatedOrder = await updateOrderConfiguration(order.id, {
      latestConfiguredByRole: actor.role || 'hub',
      latestConfiguredByUserId: actor.userId || null,
      latestConfiguredByHubId: hubId,
      latestConfigSource: 'hub_manual_override',
      printConfigSnapshot: orderPrintOptions,
      priceSnapshot: newPriceSnapshot,
      totalAmountPaise,
      amount: totalAmount,
      pages: pricedFiles.length === 1 ? totalSelectedPages : totalPrintablePages,
      copies: pricedFiles.length === 1 ? firstFile.price.copies : 1,
      colorType: pricedFiles.length === 1 ? firstFile.price.colorMode : order.colorType,
      sideType: pricedFiles.length === 1 ? firstFile.price.sides : order.sideType,
      selectedPageCount: totalSelectedPages,
      printablePageCount: totalPrintablePages,
      sheetCount: totalSheetCount
    }, client);

    // Log the configuration audit event
    const configEvent = await createOrderConfigEvent({
      orderId: order.id,
      actorRole: actor.role || 'hub',
      actorUserId: actor.userId || null,
      actorHubId: hubId,
      eventType: 'hub_manual_override',
      previousConfig,
      newConfig: orderPrintOptions,
      previousPriceSnapshot,
      newPriceSnapshot,
      previousAmountPaise,
      newAmountPaise: totalAmountPaise,
      note: note || ''
    }, client);

    return {
      success: true,
      order: updatedOrder,
      configEvent,
      files: pricedFiles.map(f => f.updatedFile)
    };
  });
}

export async function recalculateOrderPricingByDocument(documentId) {
  return await withTransaction(async (client) => {
    const orderIds = await findOrderIdsByDocumentId(documentId, client);
    if (!orderIds || orderIds.length === 0) return null;

    const results = [];
    for (const orderId of orderIds) {
      const order = await findOrderByIdOrCode(orderId, client);
      if (!order) continue;

      const existingFiles = await listOrderFiles(order.id, client);
      if (!existingFiles || existingFiles.length === 0) continue;

      // If any file in this order is still pending preparation, don't recalculate yet.
      if (existingFiles.some(f => f.document?.requiresDesktopPreparation && f.document?.preparationStatus === 'pending')) {
        continue;
      }

      const centre = await findCentreById(order.centreId, client);
      if (!centre) continue;

      const pricedFiles = [];

      for (let index = 0; index < existingFiles.length; index++) {
        const existingFile = existingFiles[index];
        const mergedPrintOptions = existingFile.printOptions;
        const copies = existingFile.copies;

        const trustedPageCount = existingFile.document?.preparedPageCount ?? existingFile.document?.pageCount ?? existingFile.originalPageCount;
        
        // Normalize print options using existing utility
        const normalizedOptions = normalizePrintOptions(mergedPrintOptions, trustedPageCount);
        normalizedOptions.copies = copies;
        
        const fileColorType = toLegacyColorType(normalizedOptions.colorMode);
        const fileSideType = toLegacySideType(normalizedOptions.sides);
        const pricedSelectedPages = normalizedOptions.pages.mode === 'custom'
          ? normalizedOptions.pages.range
          : 'all';

        const price = calculatePrintPricing({
          centre,
          originalPageCount: trustedPageCount,
          selectedPages: pricedSelectedPages,
          copies: copies,
          colorType: fileColorType,
          sideType: fileSideType,
          paperSize: normalizedOptions.paperSize,
          pagesPerSheet: normalizedOptions.pagesPerSheet,
          watermarkEnabled: normalizedOptions.watermark.enabled
        });

        const updatedFile = await updateOrderFileConfiguration(existingFile.id, {
          copies: price.copies,
          selectedPages: price.selectedPages,
          selectedPageCount: price.selectedPageCount,
          printablePageCount: price.printablePageCount,
          sheetCount: price.sheetCount,
          printOptions: normalizedOptions,
          lineAmountPaise: price.totalAmountPaise
        }, client);

        pricedFiles.push({
          id: existingFile.id,
          printSequence: existingFile.printSequence || (index + 1),
          price,
          normalizedPrintOptions: normalizedOptions,
          updatedFile
        });
      }

      const totalAmount = pricedFiles.reduce((sum, f) => sum + f.price.totalAmount, 0);
      const totalAmountPaise = pricedFiles.reduce((sum, f) => sum + f.price.totalAmountPaise, 0);
      const totalSelectedPages = pricedFiles.reduce((sum, f) => sum + f.price.selectedPageCount, 0);
      const totalPrintablePages = pricedFiles.reduce((sum, f) => sum + f.price.printablePageCount, 0);
      const totalSheetCount = pricedFiles.reduce((sum, f) => sum + f.price.sheetCount, 0);

      const firstFile = pricedFiles[0];
      const orderPrintOptions = pricedFiles.length === 1
        ? firstFile.normalizedPrintOptions
        : {
            files: pricedFiles.map((f) => ({
              documentId: f.updatedFile.documentId,
              printSequence: f.printSequence,
              printOptions: f.normalizedPrintOptions
            }))
          };

      const newPriceSnapshot = {
        amount: totalAmount,
        totalAmountPaise,
        breakdown: pricedFiles.map(f => f.price)
      };

      const updatedOrder = await updateOrderConfiguration(order.id, {
        latestConfiguredByRole: 'system',
        latestConfiguredByUserId: null,
        latestConfiguredByHubId: null,
        latestConfigSource: 'desktop_agent_preparation',
        printConfigSnapshot: orderPrintOptions,
        priceSnapshot: newPriceSnapshot,
        totalAmountPaise,
        amount: totalAmount,
        pages: pricedFiles.length === 1 ? totalSelectedPages : totalPrintablePages,
        copies: pricedFiles.length === 1 ? firstFile.price.copies : 1,
        colorType: pricedFiles.length === 1 ? firstFile.price.colorMode : order.colorType,
        sideType: pricedFiles.length === 1 ? firstFile.price.sides : order.sideType,
        selectedPageCount: totalSelectedPages,
        printablePageCount: totalPrintablePages,
        sheetCount: totalSheetCount
      }, client);

      let finalOrder = updatedOrder;


      results.push(finalOrder);
    }
    return results;
  });
}

