import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assignHub, uploadDocument } from '../uploadController.js';
import * as repo from '../../db/repository.js';
import { getPdfPageCount } from '../../utils/pdfPageCount.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

vi.mock('../../db/repository.js');
vi.mock('../../utils/pdfPageCount.js');
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdminClient: vi.fn(), getSupabaseBucketName: () => 'private' }));
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
const pdf = { mimetype: 'application/pdf', originalname: 'file.pdf', buffer: Buffer.from('%PDF-test'), size: 9 };
describe('upload and reassignment security', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSupabaseAdminClient.mockReturnValue({ storage: { from: () => ({ upload: vi.fn().mockResolvedValue({}) }) } });
    repo.createDocument.mockImplementation(async doc => doc);
  });

  it('rejects an alternate PDF before storing or counting mismatched originals', async () => {
    const res = response();
    await uploadDocument({ files: { document: [pdf], printReadyFile: [pdf] }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(repo.createDocument).not.toHaveBeenCalled();
    expect(getPdfPageCount).not.toHaveBeenCalled();
  });

  it('keeps Office uploads pending for early desktop conversion', async () => {
    const res = response();
    await uploadDocument({ files: { document: [{ ...pdf, mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }] }, body: {}, headers: {}, query: {} }, res);
    expect(repo.createDocument).toHaveBeenCalledWith(expect.objectContaining({ pageCount: null, requiresDesktopPreparation: true, preparationStatus: 'pending', guestTokenHash: expect.any(String) }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('passes authenticated owner identity into the scoped reassignment query', async () => {
    repo.findCentreById.mockResolvedValue({ id: 'hub' });
    repo.assignOwnedDocumentHub.mockResolvedValue(null);
    const res = response();
    await assignHub({ params: { documentId: 'foreign-document' }, body: { hubId: 'hub' }, user: { id: 'attacker' }, headers: {}, query: {} }, res);
    expect(repo.assignOwnedDocumentHub).toHaveBeenCalledWith('foreign-document', 'hub', { userId: 'attacker', guestTokenHash: null });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
