import { asyncHandler } from '../utils/asyncHandler.js';
import { removeExpiredDocuments } from '../services/documentRetentionService.js';
import crypto from 'node:crypto';

export async function runInternalCleanup() {
  try {
    const result = await removeExpiredDocuments();
    console.log(`[CLEANUP_JOB] Cleaned up ${result.deletedCount} expired documents.`);
    return result;

  } catch (error) {
    console.error('[CLEANUP_JOB_ERROR]', error);
    return { success: false, error: error.message };
  }
}

export const cleanupOldData = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  // Fail closed without an operator-configured secret. A published fallback
  // credential would let anyone invoke destructive retention cleanup.
  const cronSecret = process.env.SYSTEM_CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ success: false, message: 'Scheduled cleanup is not configured.' });
  }
  
  // Fixed-length digests permit timingSafeEqual even for malformed headers.
  const supplied = crypto.createHash('sha256').update(String(authHeader || '')).digest();
  const expected = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  if (!crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized cleanup request' });
  }

  const result = await runInternalCleanup();
  if (result.success) {
    return res.json({ success: true, message: `Successfully cleaned up ${result.deletedCount} documents.`, deletedCount: result.deletedCount });
  } else {
    return res.status(500).json({ success: false, message: 'Cleanup failed' });
  }
});
