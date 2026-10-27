import { beforeEach, expect, it, vi } from 'vitest';
import * as repo from '../../db/repository.js';
import { reportPreparationResult, reportVerificationResult } from '../agent/agentPreparation.js';
import { getPredownloadCandidates } from '../agent/agentJobs.js';
import { heartbeat } from '../agent/agentAuth.js';
import { syncPrinters } from '../agent/agentPrinters.js';
import { verifyAndStoreHubConvertedDocument } from '../../services/documentVerificationService.js';
import { getPrintReadyFile } from '../../utils/printReadyPdf.js';
import { resolveDownloadUrl } from '../../services/agentJobPayloadService.js';

vi.mock('../../db/repository.js');
vi.mock('../../utils/asyncHandler.js', () => ({ asyncHandler: fn => fn }));
vi.mock('../../services/documentVerificationService.js');
vi.mock('../../services/orderConfigurationService.js');
vi.mock('../../services/agentJobPayloadService.js');
vi.mock('../../utils/printReadyPdf.js');
let res;
const req = () => ({ agent: { id: 'agent', hubId: 'hub' }, params: { jobId: 'order' }, query: {}, body: { documentId: 'doc', preparationStatus: 'failed' } });
beforeEach(() => {
  vi.resetAllMocks();
  res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  repo.findDocumentById.mockResolvedValue({ id: 'doc', hubId: 'hub', preparationStatus: 'pending' });
  repo.findOrderIdsByDocumentId.mockResolvedValue([]);
});

it('rejects a foreign target order before any document mutation', async () => {
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'foreign' });
  await reportVerificationResult(req(), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(repo.updateDocumentPreparation).not.toHaveBeenCalled();
  expect(verifyAndStoreHubConvertedDocument).not.toHaveBeenCalled();
});

it('rejects another document within the same hub', async () => {
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'order', centreId: 'hub' });
  repo.listOrderFiles.mockResolvedValue([{ documentId: 'other' }]);
  await reportVerificationResult(req(), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(repo.withTransaction).not.toHaveBeenCalled();
});

it('rejects a document shared with another hub even if its current hub matches', async () => {
  repo.findOrderIdsByDocumentId.mockResolvedValue(['foreign-order']);
  repo.findOrderByIdOrCode.mockResolvedValue({ id: 'foreign-order', centreId: 'foreign' });
  await reportPreparationResult(req(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(repo.updateDocumentPreparation).not.toHaveBeenCalled();
});

it('requires real converted bytes, not agent-supplied counts and hashes', async () => {
  repo.findDocumentById.mockResolvedValue({ id: 'doc', hubId: 'hub', preparationStatus: 'pending', requiresDesktopPreparation: true });
  const request = req();
  request.body = { documentId: 'doc', preparationStatus: 'prepared', preparedPageCount: 1, printReadySha256: 'forged' };
  await reportPreparationResult(request, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(repo.updateDocumentPreparation).not.toHaveBeenCalled();
});

it('does not crash heartbeat when revocation wins the race', async () => {
  repo.updateAgentHeartbeat.mockResolvedValue(null);
  await heartbeat(req(), res);
  expect(res.status).toHaveBeenCalledWith(401);
});

it.each([null, [null], Array(101).fill({ name: 'printer' })])('rejects malformed printer sync without deleting printers', async printers => {
  const request = req();
  request.body.printers = printers;
  await syncPrinters(request, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(repo.replaceAgentPrinters).not.toHaveBeenCalled();
});

it('serializes valid printer replacement in one transaction', async () => {
  const client = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'agent' }] }) };
  repo.withTransaction.mockImplementation(cb => cb(client));
  repo.replaceAgentPrinters.mockResolvedValue([]);
  const request = req();
  request.body.printers = [{ name: 'printer' }];
  await syncPrinters(request, res);
  expect(client.query.mock.calls[0][0]).toContain('for update');
  expect(repo.replaceAgentPrinters).toHaveBeenCalledWith('agent', 'hub', expect.any(Array), client);
});

it('preserves unpaid predownload as download-only without creating or claiming print jobs', async () => {
  repo.listPendingPaymentOrderFilesForAgentPredownload.mockResolvedValue([{ orderId: 'order', paymentStatus: 'requested', file: { id: 'file', documentId: 'doc', document: {} } }]);
  getPrintReadyFile.mockResolvedValue({ fileUrl: 'private://bucket/doc', fileSha256: 'hash' });
  resolveDownloadUrl.mockResolvedValue('https://download.invalid/signed');
  const request = req();
  request.query.limit = '2.9';
  await getPredownloadCandidates(request, res);
  expect(repo.listPendingPaymentOrderFilesForAgentPredownload).toHaveBeenCalledWith('hub', { limit: 2 });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'predownload_only', files: [expect.objectContaining({ paymentStatus: 'requested' })] }));
  expect(repo.createPrintJob).not.toHaveBeenCalled();
  expect(repo.findNextPrintJobForAgent).not.toHaveBeenCalled();
  expect(repo.updatePrintJobStatus).not.toHaveBeenCalled();
});
