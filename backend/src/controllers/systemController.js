import { asyncHandler } from '../utils/asyncHandler.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { pool } from '../config/db.js';
import crypto from 'node:crypto';

export async function runInternalCleanup() {
  try {
    const result = await pool.query(
      `SELECT id, storage_path FROM documents WHERE created_at < NOW() - INTERVAL '15 days'`
    );

    const documents = result.rows;
    if (documents.length === 0) {
      console.log('[CLEANUP_JOB] No old documents to clean up.');
      return { success: true, deletedCount: 0 };
    }

    const storagePaths = documents.map(doc => doc.storage_path).filter(path => path);

    if (storagePaths.length > 0) {
      const bucketName = getSupabaseBucketName();
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.storage.from(bucketName).remove(storagePaths);
      
      if (error) {
        console.error('[CLEANUP_JOB] Failed to delete from storage:', error);
        throw error;
      }
    }

    const documentIds = documents.map(doc => doc.id);
    
    await pool.query(
      `DELETE FROM print_job_files WHERE document_id = ANY($1::uuid[])`,
      [documentIds]
    );

    await pool.query(
      `DELETE FROM print_order_files WHERE document_id = ANY($1::uuid[])`,
      [documentIds]
    );

    await pool.query(
      `DELETE FROM documents WHERE id = ANY($1::uuid[])`,
      [documentIds]
    );

    console.log(`[CLEANUP_JOB] Successfully cleaned up ${documents.length} documents.`);
    return { success: true, deletedCount: documents.length };

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
    return res.status(500).json({ success: false, message: 'Cleanup failed', error: result.error });
  }
});
