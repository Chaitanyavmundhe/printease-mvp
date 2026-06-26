import { query, pool } from './src/config/db.js';

async function run() {
  try {
    await query(`
      ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS bill_status text DEFAULT 'awaiting_hub_confirmation';
      
      DO $$
      BEGIN
        ALTER TABLE print_orders ADD CONSTRAINT print_orders_bill_status_check CHECK (
          bill_status IS NULL OR
          bill_status IN (
            'awaiting_hub_confirmation',
            'confirmed',
            'mismatch'
          )
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log("Migration successful");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
