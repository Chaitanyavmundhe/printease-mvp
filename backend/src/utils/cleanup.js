import { pool } from '../db/client.js';

export async function cleanupExpiredGuestOrders() {
  console.log('[Cleanup] Starting expired guest orders cleanup...');
  try {
    const result = await pool.query(`
      DELETE FROM print_orders
      WHERE customer_type = 'guest'
        AND payment_status NOT IN ('paid', 'collected', 'verified')
        AND expires_at < now()
    `);
    console.log(`[Cleanup] Deleted ${result.rowCount} expired guest orders.`);
  } catch (error) {
    console.error('[Cleanup] Error deleting expired guest orders:', error);
  }
}

// If run directly: node backend/src/utils/cleanup.js
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredGuestOrders().then(() => process.exit(0));
}
