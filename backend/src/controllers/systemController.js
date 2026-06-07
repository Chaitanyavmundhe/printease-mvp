import { asyncHandler } from '../utils/asyncHandler.js';
import { supabase, getSupabaseBucketName } from '../config/supabase.js';
import { executor } from '../db/client.js';

export async function runInternalCleanup() {
  try {
    const result = await executor().query(
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
      const { error } = await supabase.storage.from(bucketName).remove(storagePaths);
      
      if (error) {
        console.error('[CLEANUP_JOB] Failed to delete from storage:', error);
        throw error;
      }
    }

    const documentIds = documents.map(doc => doc.id);
    
    await executor().query(
      `DELETE FROM print_order_files WHERE document_id = ANY($1::text[])`,
      [documentIds]
    );

    await executor().query(
      `DELETE FROM documents WHERE id = ANY($1::text[])`,
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
  const cronSecret = process.env.SYSTEM_CRON_SECRET || 'printease_secret_cleanup_token';
  
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized cleanup request' });
  }

  const result = await runInternalCleanup();
  if (result.success) {
    return res.json({ success: true, message: `Successfully cleaned up ${result.deletedCount} documents.`, deletedCount: result.deletedCount });
  } else {
    return res.status(500).json({ success: false, message: 'Cleanup failed', error: result.error });
  }
});
