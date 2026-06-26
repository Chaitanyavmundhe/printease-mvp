import crypto from 'crypto';
import path from 'path';
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

/**
 * Validates, counts pages, and securely stores a PDF converted by a Hub Desktop Agent.
 * Rejects invalid or corrupt PDFs.
 */
export async function verifyAndStoreHubConvertedDocument({ documentId, originalFileName, pdfBuffer }) {
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new Error('Converted document must be a valid file buffer.');
  }

  // 1. Verify PDF and count pages securely (backend becomes source of truth)
  let verifiedPageCount;
  try {
    verifiedPageCount = await getPdfPageCount(pdfBuffer);
  } catch (error) {
    throw new Error(`Backend verification failed: ${error.message}`);
  }

  // 2. Hash the file
  const printReadySha256 = crypto
    .createHash('sha256')
    .update(pdfBuffer)
    .digest('hex');

  // 3. Upload to secure private storage
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseBucketName();
  
  const prCleanedName = safeFileName(originalFileName || 'print-ready.pdf');
  const printReadyStoragePath = `hub-converted/${documentId}-${Date.now()}-pr-${prCleanedName}`;

  const { error: prUploadError } = await supabase.storage
    .from(bucket)
    .upload(printReadyStoragePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (prUploadError) {
    throw new Error(`Failed to store converted document in private storage: ${prUploadError.message}`);
  }

  return {
    verifiedPageCount,
    printReadyStoragePath,
    printReadySha256
  };
}
