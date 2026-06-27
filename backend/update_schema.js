import { pool } from './src/config/db.js';
async function run() {
  await pool.query('alter table documents add column if not exists hub_id text references print_hubs(id) on delete set null');
  await pool.query('create index if not exists idx_documents_hub_id on documents(hub_id)');
  console.log('Schema updated successfully');
  process.exit(0);
}
run().catch(console.error);
