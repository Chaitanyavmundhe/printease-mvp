import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const host = process.env.PGHOST || '/var/run/postgresql';
const sslEnabled = process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require';

export const pool = new Pool({
  ...(connectionString
    ? { connectionString }
    : {
        database: process.env.PGDATABASE || 'printease',
        host,
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD || ''
      }),
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testDatabaseConnection() {
  const result = await query('select now() as now');
  return result.rows[0];
}

export function getDatabaseInfo() {
  return {
    provider: 'PostgreSQL',
    status: connectionString ? 'DATABASE_URL configured' : 'local PG* environment configured',
    ssl: sslEnabled
  };
}
