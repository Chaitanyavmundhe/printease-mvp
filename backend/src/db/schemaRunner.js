import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function applySchema() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
}
