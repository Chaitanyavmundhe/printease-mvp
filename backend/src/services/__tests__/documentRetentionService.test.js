import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withTransaction } from '../../config/db.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { removeExpiredDocuments } from '../documentRetentionService.js';

vi.mock('../../config/db.js', () => ({ withTransaction: vi.fn() }));
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdminClient: vi.fn(), getSupabaseBucketName: () => 'private-documents' }));
describe('private document retention', () => {
  let client, remove;
  beforeEach(() => {
    vi.resetAllMocks();
    client = { query: vi.fn().mockImplementation(async sql => ({ rows: sql.includes('pg_try_advisory') ? [{ acquired: true }] : sql.includes('select d.id') ? [{ id: 'text-document', storage_path: 'original.docx', print_ready_storage_path: 'converted.pdf' }] : [] })) };
    remove = vi.fn().mockResolvedValue({ error: null });
    withTransaction.mockImplementation(callback => callback(client));
    getSupabaseAdminClient.mockReturnValue({ storage: { from: () => ({ remove }) } });
  });
  it('removes both original and converted objects and uses portable IDs', async () => {
    expect(await removeExpiredDocuments()).toEqual({ success: true, deletedCount: 1 });
    expect(remove).toHaveBeenCalledWith(['original.docx', 'converted.pdf']);
    const deletions = client.query.mock.calls.filter(([sql]) => sql.startsWith('delete'));
    expect(deletions).toHaveLength(3);
    for (const [sql, values] of deletions) {
      expect(sql).toContain('::text[]');
      expect(values).toEqual([['text-document']]);
    }
    const selection = client.query.mock.calls.find(([sql]) => sql.includes('select d.id'))[0];
    expect(selection).toContain('limit 100');
    expect(selection).toContain('submitted_to_printer');
  });
  it('retains database rows when private storage fails', async () => {
    remove.mockResolvedValue({ error: new Error('private upstream detail') });
    await expect(removeExpiredDocuments()).rejects.toThrow('Document storage cleanup failed.');
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('delete'))).toBe(false);
  });
  it('does not run duplicate cleanup callers', async () => {
    client.query.mockResolvedValue({ rows: [{ acquired: false }] });
    expect((await removeExpiredDocuments()).skipped).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });
});
