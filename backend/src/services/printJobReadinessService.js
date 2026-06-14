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

  const allFilesPrintable = orderFiles.every((file) => {
    const isDocAvailable = Boolean(file.document?.storagePath || file.document?.printReadyStoragePath);
    const hasHash = Boolean(file.document?.fileSha256 || file.document?.printReadySha256);
    const isPrintReady = Boolean(file.document?.printReadyStoragePath);
    const mimeType = file.document?.fileType || 'application/pdf';
    return isDocAvailable && hasHash && (isPrintReady || isPrintableUploadMimeType(mimeType) || isDesktopPreparableMimeType(mimeType));
  });

  const isFirstFilePrintable = Boolean(firstFile?.document?.printReadyStoragePath) || isPrintableUploadMimeType(fileType) || isDesktopPreparableMimeType(fileType);
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
