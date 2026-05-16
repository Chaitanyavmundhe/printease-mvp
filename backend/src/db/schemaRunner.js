import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function applySchema() {
  console.log('[DB CHECK STARTED]');

  try {
    const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
    await query(sql);
    console.log('[DB SCHEMA APPLIED]');
  } catch (error) {
    console.error('[DB CHECK FAILED]', {
      message: error.message
    });
    throw error;
  }
}
