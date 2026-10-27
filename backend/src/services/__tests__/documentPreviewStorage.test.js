import { beforeEach, expect, it, vi } from 'vitest';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { fetchDocumentBuffer } from '../documentPreviewService.js';
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdminClient: vi.fn(), getSupabaseBucketName: () => 'private' }));
vi.mock('../../db/repository.js');
let info, download;
beforeEach(() => {
  vi.resetAllMocks();
  info = vi.fn().mockResolvedValue({ data: { size: 4 } });
  download = vi.fn().mockResolvedValue({ data: new Blob(['test']) });
  getSupabaseAdminClient.mockReturnValue({ storage: { from: () => ({ info, download }) } });
});
it('uses the installed storage SDK info endpoint and downloads an authorized bounded file', async () => {
  expect((await fetchDocumentBuffer({ storagePath: 'verified.pdf' })).toString()).toBe('test');
  expect(info).toHaveBeenCalledWith('verified.pdf');
});
it('refuses missing or oversized metadata before allocating a preview', async () => {
  for (const data of [{}, { size: 51 * 1024 * 1024 }]) {
    info.mockResolvedValue({ data });
    await expect(fetchDocumentBuffer({ storagePath: 'file' })).rejects.toHaveProperty('status');
  }
  expect(download).not.toHaveBeenCalled();
});
it('does not expose upstream storage errors', async () => {
  info.mockResolvedValue({ error: { message: 'secret upstream details' } });
  await expect(fetchDocumentBuffer({ storagePath: 'file' })).rejects.toEqual({ status: 502, message: 'Failed to retrieve storage file metadata' });
});
