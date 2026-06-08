import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '20260610_schema_health_audit.sql'), 'utf-8');

async function run() {
  const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
  for (const q of queries) {
    console.log('\n--- Running:');
    const lines = q.split('\n');
    console.log(lines.slice(0, 2).join('\n') + '...');
    try {
      const res = await query(q);
      console.log('Results:', res.rows);
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
  process.exit(0);
}
run();
