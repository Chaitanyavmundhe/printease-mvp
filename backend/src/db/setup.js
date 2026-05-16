import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runSqlFile(fileName) {
  const sql = await readFile(join(__dirname, fileName), 'utf8');
  await query(sql);
  console.log(`Applied ${fileName}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));

  if (!args.has('--seed-only')) {
    await runSqlFile('schema.sql');
  }
   
  if (!args.has('--schema-only')) {
    await runSqlFile('seed.sql');
  }

  console.log('Database setup complete');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
