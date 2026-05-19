import {
  createDocumentAccessLog,
  findDocumentAccessContext
} from '../db/repository.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SIGNED_URL_TTL_SECONDS = 5 * 60;

function getRequestIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

export const createSignedDownload = asyncHandler(async (req, res) => {
  const context = await findDocumentAccessContext(req.params.documentId, req.user);

  if (!context) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  if (!context.allowed) {
    return res.status(403).json({ success: false, message: 'You are not allowed to download this document' });
  }

  if (!context.document.storagePath) {
    return res.status(404).json({ success: false, message: 'Document is not available in private storage' });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(getSupabaseBucketName())
    .createSignedUrl(context.document.storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return res.status(502).json({
      success: false,
      message: error?.message || 'Could not create signed download URL'
    });
  }

  await createDocumentAccessLog({
    id: generateId(),
    documentId: context.document.id,
    orderId: context.orderId,
    userId: req.user?.id || null,
    action: 'signed_download',
    ipAddress: getRequestIp(req),
    userAgent: req.headers['user-agent'] || null
  });

  res.json({
    success: true,
    document: {
      id: context.document.id,
      fileName: context.document.fileName,
      fileType: context.document.fileType,
      fileSizeBytes: context.document.fileSizeBytes,
      fileSha256: context.document.fileSha256,
      pageCount: context.document.pageCount,
      uploadedAt: context.document.createdAt
    },
    signedUrl: data.signedUrl,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS
  });
});
