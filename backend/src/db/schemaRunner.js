import { readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { withTransaction } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Schema DDL and its migration ledger must share one connection and commit.
// A transaction-scoped lock also serializes overlapping Render starts without
// relying on session locks (which are unsafe behind a transaction pooler).
export async function applySchema() {
  return withTransaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(178423, 1)');
    return applySchemaOnClient(client);
  });
}

async function applySchemaOnClient(client) {
  console.log('[DB CHECK STARTED]');

  try {
    const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
    // Adjust referring column types to match existing database id column types
    // This helps avoid foreign-key type mismatches when the target DB uses `uuid`.
    let adjustedSql = sql;

    // Find occurrences like: "<col> text [not null] references <table>(id)"
    const refPattern = /(\b\w+\b)\s+text(\s+not\s+null)?\s+references\s+(\b\w+\b)\(id\)/gi;
    const matches = [];
    let m;
    while ((m = refPattern.exec(sql)) !== null) {
      matches.push({ full: m[0], col: m[1], notNull: m[2] || '', refTable: m[3] });
    }

    for (const match of matches) {
      try {
        // Check the actual type of the referenced table's id column, if it exists
        const res = await client.query(
          `select udt_name from information_schema.columns where table_schema = current_schema() and table_name = $1 and column_name = 'id' limit 1`,
          [match.refTable]
        );

        const dbType = res.rows[0] && res.rows[0].udt_name ? String(res.rows[0].udt_name).toLowerCase() : null;
        if (dbType && dbType !== 'text') {
          // Replace the specific occurrence with the matching db type (e.g., uuid)
          const replacement = `${match.col} ${dbType}${match.notNull} references ${match.refTable}(id)`;
          adjustedSql = adjustedSql.replace(match.full, replacement);
        }
      } catch (err) {
        // A failed query aborts this transaction; do not run guessed DDL afterward.
        throw err;
      }
    }

    await client.query(adjustedSql);
    console.log('[DB SCHEMA APPLIED]');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    console.log('[DB MIGRATION TABLE READY]');

    // Run migrations
    try {
      const migrationsDir = join(__dirname, 'migrations');
      const files = await readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
      for (const file of sqlFiles) {
        const version = file.replace('.sql', '');
        
        const { rows } = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
        if (rows.length > 0) {
          console.log(`[DB MIGRATION] Skipping ${file} (already applied)`);
          continue;
        }

        console.log(`[DB MIGRATION] Running ${file}...`);
        const migrationSql = await readFile(join(migrationsDir, file), 'utf8');
        
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    
  } catch (error) {
    console.error('[DB CHECK FAILED]', {
      message: error.message
    });
    throw error;
  }
}
