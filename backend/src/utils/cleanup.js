import { pool } from '../config/db.js';
import { runInternalCleanup } from '../controllers/systemController.js';

export async function cleanupExpiredGuestOrders() {
  console.log('[Cleanup] Starting 15-day document cleanup...');
  await runInternalCleanup();
}

// If run directly: node backend/src/utils/cleanup.js
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredGuestOrders().then(() => process.exit(0));
}
