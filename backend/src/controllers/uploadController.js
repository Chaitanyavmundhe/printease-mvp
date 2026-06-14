import crypto from 'crypto';
import path from 'path';
import { createDocument } from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPptxSlideCount } from '../utils/pptxParser.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { getPdfPageCount } from '../utils/pdfPageCount.js';
import { createGuestToken, hashGuestToken, getGuestExpiry } from '../services/guestAccessService.js';
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
  let printReadyFile = req.files?.printReadyFile?.[0];
  
  if (printReadyFile && (printReadyFile.mimetype !== 'application/pdf' || !looksLikePdf(printReadyFile.buffer))) {
    printReadyFile = null;
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

  if (isPdf && !looksLikePdf(mainFile.buffer)) {
    return res.status(400).json({
      success: false,
      message: 'Uploaded file is not a valid PDF.'
    });
  }

  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseBucketName();
  let pageCount = 1;

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
      if (process.env.NODE_ENV !== 'production') {
        console.debug('Could not read page count from printReadyFile:', error?.message);
      }
    }
  } else if (mainFile.mimetype === 'image/jpeg' || mainFile.mimetype === 'image/png' || mainFile.mimetype === 'image/webp') {
    pageCount = 1;
  } else if (mainFile.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    const slideCount = getPptxSlideCount(mainFile.buffer);
    if (slideCount) {
      pageCount = slideCount;
    } else {
      pageCount = null;
    }
  } else if (
    mainFile.mimetype.includes('officedocument') ||
    mainFile.mimetype.includes('msword') ||
    mainFile.mimetype.includes('ms-excel')
  ) {
    pageCount = null;
  }

  const isOfficeFormat = mainFile.mimetype.includes('officedocument') || mainFile.mimetype.includes('msword') || mainFile.mimetype.includes('ms-excel');
  const needsDesktopPrep = req.body.requiresDesktopPreparation === 'true' || (isOfficeFormat && pageCount === null);
  const preparationStatus = needsDesktopPrep ? 'pending' : 'prepared';

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
      message: 'Failed to upload document to secure storage',
      error: uploadError.message
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
      console.error('Supabase print-ready upload failed:', prUploadError);
      // We will proceed without printReadyFile if it fails
      printReadyStoragePath = null;
      printReadySha256 = null;
    }
  }

  let guestToken = null;
  let guestTokenHash = null;
  let expiresAt = null;

  if (!req.user) {
    guestToken = req.headers['x-order-access-token'] || req.query.token;
    if (!guestToken) {
      guestToken = createGuestToken();
    }
    guestTokenHash = hashGuestToken(guestToken);
    expiresAt = getGuestExpiry();
  }

  const document = await createDocument({
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
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded securely',
    document,
    guestToken
  });
});
