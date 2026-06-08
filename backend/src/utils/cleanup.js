import { pool } from '../config/db.js';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';

export async function cleanupExpiredGuestOrders() {
  console.log('[Cleanup] Starting expired guest orders cleanup...');
  try {
    const ordersResult = await pool.query(`
      SELECT po.id, pof.document_id, d.storage_path
      FROM print_orders po
      LEFT JOIN print_order_files pof ON pof.order_id = po.id
      LEFT JOIN documents d ON d.id = pof.document_id
      WHERE po.customer_type = 'guest'
        AND po.payment_status NOT IN ('paid', 'collected', 'verified')
        AND po.expires_at < now()
    `);

    const orders = ordersResult.rows;
    if (orders.length === 0) {
      console.log('[Cleanup] No expired guest orders found.');
      return;
    }

    const orderIds = [...new Set(orders.map(o => o.id))];
    const documentIds = [...new Set(orders.map(o => o.document_id).filter(Boolean))];
    const storagePaths = [...new Set(orders.map(o => o.storage_path).filter(Boolean))];

    if (storagePaths.length > 0) {
      const supabase = getSupabaseAdminClient();
      const bucket = getSupabaseBucketName();
      const { error } = await supabase.storage.from(bucket).remove(storagePaths);
      if (error) {
        console.error('[Cleanup] Error deleting files from Supabase Storage:', error);
      } else {
        console.log(`[Cleanup] Deleted ${storagePaths.length} files from Supabase Storage.`);
      }
    }

    if (documentIds.length > 0) {
      await pool.query(`DELETE FROM documents WHERE id = ANY($1::text[])`, [documentIds]);
      console.log(`[Cleanup] Deleted ${documentIds.length} document records.`);
    }

    const deleteResult = await pool.query(`
      DELETE FROM print_orders WHERE id = ANY($1::text[])
    `, [orderIds]);

    console.log(`[Cleanup] Deleted ${deleteResult.rowCount} expired guest orders.`);
  } catch (error) {
    console.error('[Cleanup] Error deleting expired guest orders:', error);
  }
}

// If run directly: node backend/src/utils/cleanup.js
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredGuestOrders().then(() => process.exit(0));
}
