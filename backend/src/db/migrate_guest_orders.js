import { query } from './../config/db.js';

async function migrate() {
  try {
    await query(`
      ALTER TABLE print_orders
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'registered';
    `);
    await query(`
      UPDATE print_orders
      SET customer_type = CASE WHEN user_id IS NOT NULL THEN 'registered' ELSE 'guest' END
      WHERE customer_type IS NULL OR customer_type = 'registered';
    `);
    console.log("Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
