import crypto from 'crypto';
import path from 'path';
import { assignOwnedDocumentHub, createDocument, findCentreById } from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { getPdfPageCount } from '../utils/pdfPageCount.js';
import { createGuestToken, hashGuestToken, getGuestExpiry, getGuestTokenHashFromRequest } from '../services/guestAccessService.js';
import { formatAllowedUploadTypes, isAllowedUploadMimeType } from '../constants/upload.js';

function safeFileName(name) {
  const ext = path.extname(name || '').toLowerCase();
  const base = path
    .basename(name || 'document', ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return `${base || 'document'}${ext || '.pdf'}`;
}

function looksLikePdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

export const uploadDocument = asyncHandler(async (req, res) => {
  const mainFile = req.files?.document?.[0] || req.file;
  const printReadyFile = req.files?.printReadyFile?.[0];
  
  if (printReadyFile && (printReadyFile.mimetype !== 'application/pdf' || !looksLikePdf(printReadyFile.buffer))) {
    return res.status(400).json({ success: false, message: 'Print-ready file must be a valid PDF.' });
  }

  if (!mainFile) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (!isAllowedUploadMimeType(mainFile.mimetype)) {
    return res.status(400).json({
      success: false,
      message: `Unsupported file type. Allowed types: ${formatAllowedUploadTypes()}`
    });
  }

  const isPdf = mainFile.mimetype === 'application/pdf';

  // Count and print the same PDF: an alternate artifact could otherwise hide
  // more printable pages behind the original document's verified bill.
  if (isPdf && printReadyFile) {
    return res.status(400).json({ success: false, message: 'Upload the final PDF as document without an alternate print-ready file.' });
  }

  if (isPdf && !looksLikePdf(mainFile.buffer)) {
    return res.status(400).json({
      success: false,
      message: 'Uploaded file is not a valid PDF.'
    });
  }

  let guestToken = null;
  let guestTokenHash = null;
  let expiresAt = null;
  if (!req.user) {
    guestToken = req.headers?.['x-order-access-token'] || req.query?.token || createGuestToken();
    guestTokenHash = hashGuestToken(guestToken);
    if (!guestTokenHash) {
      return res.status(400).json({ success: false, message: 'Invalid guest access token.' });
    }
    expiresAt = getGuestExpiry();
  }

  if (req.body.hubId && !(await findCentreById(req.body.hubId))) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }

  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseBucketName();
  let pageCount = null;

  if (isPdf) {
    try {
      pageCount = await getPdfPageCount(mainFile.buffer);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Could not read PDF page count. Please upload a valid, uncorrupted PDF.'
      });
    }
  } else if (printReadyFile && printReadyFile.mimetype === 'application/pdf') {
    try {
      pageCount = await getPdfPageCount(printReadyFile.buffer);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Could not read print-ready PDF.' });
    }
  } else if (mainFile.mimetype === 'image/jpeg' || mainFile.mimetype === 'image/png' || mainFile.mimetype === 'image/webp') {
    pageCount = 1;
  } else if (
    mainFile.mimetype.includes('officedocument') ||
    mainFile.mimetype.includes('msword') ||
    mainFile.mimetype.includes('ms-excel')
  ) {
    pageCount = null;
  }

  const isOfficeFormat = mainFile.mimetype.includes('officedocument') ||
    mainFile.mimetype.includes('opendocument') ||
    mainFile.mimetype.includes('msword') ||
    mainFile.mimetype.includes('ms-excel') ||
    mainFile.mimetype.includes('ms-powerpoint');
  const canDesktopPrepare = isOfficeFormat ||
    mainFile.mimetype.startsWith('text/') ||
    mainFile.mimetype === 'application/json' ||
    mainFile.mimetype === 'image/gif' ||
    mainFile.mimetype === 'image/bmp' ||
    mainFile.mimetype === 'image/tiff';
  const hasTrustedPrintReadyPageCount = Boolean(printReadyFile && Number.isFinite(pageCount) && pageCount > 0);
  const requestedDesktopPrep = String(req.body.requiresDesktopPreparation || '').toLowerCase() === 'true';
  // Never mark a document prepared unless the backend has a trusted PDF page count.
  // Office/large-format documents are uploaded as originals and the paired hub
  // desktop later converts them, uploads the PDF, and lets the backend verify it.
  const needsDesktopPrep = Boolean(!hasTrustedPrintReadyPageCount && canDesktopPrepare && (isOfficeFormat || requestedDesktopPrep || !pageCount));
  const preparationStatus = needsDesktopPrep ? 'pending' : 'prepared';
  if (needsDesktopPrep) {
    pageCount = null;
  }

  const documentId = generateId();
  const originalName = mainFile.originalname || 'document.pdf';
  const cleanedName = safeFileName(originalName);
  const userFolder = req.user?.id || `limited/${documentId}`;
  const storagePath = `${userFolder}/${documentId}-${Date.now()}-${cleanedName}`;

  const fileSha256 = crypto
    .createHash('sha256')
    .update(mainFile.buffer)
    .digest('hex');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, mainFile.buffer, {
      contentType: mainFile.mimetype,
      upsert: false
    });

  if (uploadError) {
    console.error('Supabase upload failed:', uploadError);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload document to secure storage'
    });
  }

  let printReadyStoragePath = null;
  let printReadySha256 = null;

  if (printReadyFile) {
    const prCleanedName = safeFileName(printReadyFile.originalname || 'print-ready.pdf');
    printReadyStoragePath = `${userFolder}/${documentId}-${Date.now()}-pr-${prCleanedName}`;
    printReadySha256 = crypto
      .createHash('sha256')
      .update(printReadyFile.buffer)
      .digest('hex');

    const { error: prUploadError } = await supabase.storage
      .from(bucket)
      .upload(printReadyStoragePath, printReadyFile.buffer, {
        contentType: printReadyFile.mimetype,
        upsert: false
      });

    if (prUploadError) {
      // Do not retain a bill based on converted bytes that were never stored.
      // Remove the orphaned original and let the client retry the whole upload.
      console.error('Supabase print-ready upload failed:', prUploadError);
      await supabase.storage.from(bucket).remove([storagePath]).catch(() => {});
      return res.status(502).json({ success: false, message: 'Could not store the verified printable PDF. Please retry the upload.' });
    }
  }

  let document;
  try {
    document = await createDocument({
    id: documentId,
    userId: req.user?.id || null,
    fileName: originalName,
    fileType: mainFile.mimetype,
    fileSize: mainFile.size,
    fileSizeBytes: mainFile.size,
    fileUrl: `private://${bucket}/${storagePath}`,
    storagePath,
    fileSha256,
    printReadyStoragePath,
    printReadySha256,
    conversionSource: req.body.conversionSource || null,
    conversionPlacement: req.body.conversionPlacement || null,
    conversionReasonCode: req.body.conversionReasonCode || null,
    fileKind: req.body.fileKind || null,
    requiresDesktopPreparation: needsDesktopPrep,
    pageCount,
    preparedPageCount: null,
    preparationStatus,
    preparationErrorCode: null,
    preparationErrorMessage: null,
    preparedAt: null,
    guestTokenHash,
    expiresAt,
    hubId: req.body.hubId || null,
    createdAt: new Date().toISOString()
    });
  } catch (error) {
    // Storage and Postgres cannot share a transaction. Compensate for failed
    // persistence so unauthenticated uploads cannot accumulate orphaned files.
    const paths = [storagePath, printReadyStoragePath].filter(Boolean);
    await supabase.storage.from(bucket).remove(paths).catch(() => {});
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'Document uploaded securely',
    document: { ...document, guestTokenHash: undefined },
    guestToken
  });
});

export const assignHub = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { hubId } = req.body;

  if (!hubId) {
    return res.status(400).json({ success: false, message: 'hubId is required' });
  }

  if (!(await findCentreById(hubId))) {
    return res.status(404).json({ success: false, message: 'Centre not found' });
  }
  // Knowing a document ID is not ownership; the SQL mutation checks the uploader
  // or expiring anonymous capability and preserves existing order destinations.
  const document = await assignOwnedDocumentHub(documentId, hubId, {
    userId: req.user?.id,
    guestTokenHash: getGuestTokenHashFromRequest(req)
  });

  if (!document) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  res.json({
    success: true,
    message: 'Hub assigned successfully',
    document: { ...document, guestTokenHash: undefined }
  });
});
