import { isPrintableUploadMimeType, isDesktopPreparableMimeType } from '../constants/upload.js';

export function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPrintableOrderStatus(status) {
  const normalized = normalize(status);
  return ![
    'printing',
    'ready for pickup',
    'collected',
    'printing failed',
    'paused',
    'cancelled',
    'refund requested'
  ].includes(normalized);
}

export function paymentReadyMessage(paymentStatus, text) {
  const normalized = normalize(paymentStatus);
  const prefix = normalized === 'collected'
    ? 'Payment collected'
    : normalized === 'verified'
      ? 'Payment verified'
      : 'Payment pending';
  return `${prefix}. ${text}`;
}

export function optionsForDeliveredPdf(printOptions, transformed) {
  if (!transformed) return printOptions || {};

  return {
    ...(printOptions || {}),
    pages: {
      mode: 'all',
      range: ''
    },
    watermark: {
      ...((printOptions || {}).watermark || {}),
      enabled: false
    }
  };
}

export function verifyPrintFilesReadiness(orderFiles, orderWithDocument) {
  if (!orderFiles || !orderFiles.length) {
    return { isReady: false };
  }

  const firstFile = orderFiles[0];
  const storagePath = firstFile?.document?.printReadyStoragePath || firstFile?.document?.storagePath || orderWithDocument?.document_storage_path;
  const fileSha256 = firstFile?.document?.printReadySha256 || firstFile?.document?.fileSha256 || orderWithDocument?.document_file_sha256;
  const fileType = firstFile?.document?.printReadyStoragePath ? 'application/pdf' : (firstFile?.document?.fileType || orderWithDocument?.document_file_type || 'application/pdf');

  const isFileReadyForPrint = (file) => {
    const document = file?.document || {};
    const mimeType = document.fileType || 'application/pdf';
    const hasOriginal = Boolean(document.storagePath && document.fileSha256);
    const hasPrintReadyPdf = Boolean(document.printReadyStoragePath && document.printReadySha256);
    const needsDesktopPreparation = isDesktopPreparableMimeType(mimeType) && !isPrintableUploadMimeType(mimeType);

    // Office/OpenDocument files are allowed for upload, but they are not safe to
    // queue for printing until the desktop conversion agent has uploaded a
    // backend-verified PDF. This keeps cash collection from printing originals.
    if (needsDesktopPreparation || document.requiresDesktopPreparation) {
      return hasPrintReadyPdf;
    }

    return hasPrintReadyPdf || (hasOriginal && isPrintableUploadMimeType(mimeType));
  };

  const allFilesPrintable = orderFiles.every((file) => {
    return isFileReadyForPrint(file);
  });

  const isFirstFilePrintable = isFileReadyForPrint(firstFile);
  const isReady = Boolean(storagePath && fileSha256 && isFirstFilePrintable && allFilesPrintable && isPrintableOrderStatus(orderWithDocument?.status));

  return {
    isReady,
    firstFile,
    storagePath,
    fileSha256,
    fileType,
    allFilesPrintable,
    conversionSource: firstFile?.document?.conversionSource || null,
    conversionPlacement: firstFile?.document?.conversionPlacement || null
  };
}
