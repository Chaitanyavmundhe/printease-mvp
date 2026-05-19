import crypto from 'crypto';
import path from 'path';
import { createDocument } from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { getPdfPageCount } from '../utils/pdfPageCount.js';

function safeFileName(name) {
  const ext = path.extname(name || '').toLowerCase();
  const base = path
    .basename(name || 'document', ext)
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return `${base || 'document'}${ext || '.pdf'}`;
}

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  if (req.file.mimetype !== 'application/pdf') {
    return res.status(400).json({
      success: false,
      message: 'Only PDF files are supported for agent printing MVP'
    });
  }

  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseBucketName();
  let pageCount;

  try {
    pageCount = await getPdfPageCount(req.file.buffer);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Could not read PDF page count. Please upload a valid, uncorrupted PDF.'
    });
  }

  const documentId = generateId();
  const originalName = req.file.originalname || 'document.pdf';
  const cleanedName = safeFileName(originalName);
  const userFolder = req.user?.id || 'guest';
  const storagePath = `${userFolder}/${documentId}-${Date.now()}-${cleanedName}`;

  const fileSha256 = crypto
    .createHash('sha256')
    .update(req.file.buffer)
    .digest('hex');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
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

  const document = await createDocument({
    id: documentId,
    userId: req.user?.id || null,
    fileName: originalName,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    fileSizeBytes: req.file.size,
    fileUrl: `private://${bucket}/${storagePath}`,
    storagePath,
    fileSha256,
    pageCount,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded securely',
    document
  });
});
