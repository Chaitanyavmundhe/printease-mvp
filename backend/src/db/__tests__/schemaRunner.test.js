import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applySchema } from '../schemaRunner.js';
import { withTransaction } from '../../config/db.js';
import { readFile, readdir } from 'fs/promises';

vi.mock('../../config/db.js', () => ({ withTransaction: vi.fn() }));
vi.mock('fs/promises', () => ({ readFile: vi.fn(), readdir: vi.fn() }));

describe('atomic startup schema migration', () => {
  let client;
  beforeEach(() => {
    vi.resetAllMocks();
    client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    withTransaction.mockImplementation(callback => callback(client));
    readFile.mockImplementation(async path => String(path).endsWith('schema.sql') ? 'create table example(id text);' : 'alter table example add column test text;');
    readdir.mockResolvedValue(['002.sql', '001.sql']);
  });

  it('uses only the transaction client for DDL and migration records in sorted order', async () => {
    await applySchema();
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    const writes = client.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO schema_migrations'));
    expect(writes.map(([, values]) => values[0])).toEqual(['001', '002']);
    expect(client.query.mock.calls.some(([sql]) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
  });

  it('propagates migration errors to rollback and never records a failed migration', async () => {
    client.query.mockImplementation(async sql => {
      if (sql.startsWith('alter table')) throw new Error('invalid migration');
      return { rows: [] };
    });
    await expect(applySchema()).rejects.toThrow('invalid migration');
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO schema_migrations'))).toBe(false);
  });

  it('does not reapply ledger entries', async () => {
    client.query.mockImplementation(async sql => ({ rows: sql.startsWith('SELECT version') ? [{ version: 'already' }] : [] }));
    await applySchema();
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('alter table'))).toBe(false);
  });
});
