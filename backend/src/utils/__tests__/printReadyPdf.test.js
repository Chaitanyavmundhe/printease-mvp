import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { getPrintReadyFile } from '../printReadyPdf.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdminClient: vi.fn(), getSupabaseBucketName: () => 'private' }));
let source;
let hash;
let storage;
function file(overrides = {}) {
  return {
    id: 'file', orderId: 'order', originalPageCount: 3, selectedPageCount: 1, selectedPages: '2', createdAt: '2026-10-26T12:00:00.000Z',
    printOptions: { pages: { range: '2' } },
    document: {
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileUrl: 'private://private/original.docx', printReadyStoragePath: 'converted.pdf', printReadySha256: hash,
      pageCount: 3, preparedPageCount: 3,
    }, ...overrides,
  };
}
describe('verified converted PDF delivery', () => {
  beforeEach(async () => {
    const pdf = await PDFDocument.create();
    for (let page = 0; page < 3; page++) pdf.addPage([300, 400]);
    source = Buffer.from(await pdf.save());
    hash = crypto.createHash('sha256').update(source).digest('hex');
    storage = {
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: async () => source }, error: null }),
      upload: vi.fn().mockResolvedValue({ error: null }),
    };
    getSupabaseAdminClient.mockReturnValue({ storage: { from: () => storage } });
  });
  it('slices the already converted Word PDF and delivers exactly the selected page', async () => {
    const result = await getPrintReadyFile({ id: 'order' }, file());
    const [outputPath, output] = storage.upload.mock.calls[0];
    expect(storage.download).toHaveBeenCalledWith('converted.pdf');
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1);
    expect(result.fileType).toBe('application/pdf');
    expect(result.transformed).toBe(true);
    expect(result.fileSha256).toBe(crypto.createHash('sha256').update(output).digest('hex'));
    expect(outputPath).toContain(result.fileSha256);
  });
  it('can apply a watermark to converted Office PDF bytes', async () => {
    await getPrintReadyFile({ id: 'order' }, file({
      selectedPageCount: 3, selectedPages: 'all',
      printOptions: { pages: { range: 'all' }, watermark: { enabled: true, type: 'custom_text', text: 'PrintEase' } },
    }));
    expect((await PDFDocument.load(storage.upload.mock.calls[0][1])).getPageCount()).toBe(3);
  });
  it('rejects a changed source rather than pricing and printing different bytes', async () => {
    const bad = file();
    bad.document.printReadySha256 = 'not-the-verified-source';
    await expect(getPrintReadyFile({ id: 'order' }, bad)).rejects.toThrow(/verified hash/);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('uses verified pages when a legacy order file has zero original pages', async () => {
    const legacy = file({ originalPageCount: 0 });
    legacy.document.pageCount = null;
    await getPrintReadyFile({ id: 'order' }, legacy);
    expect((await PDFDocument.load(storage.upload.mock.calls[0][1])).getPageCount()).toBe(1);
  });
  it('does not overwrite a different rendering behind a previously issued URL', async () => {
    const first = await getPrintReadyFile({ id: 'order' }, file());
    const second = await getPrintReadyFile({ id: 'order' }, file({ selectedPages: '3', printOptions: { pages: { range: '3' }, watermark: { enabled: true, type: 'custom_text', text: 'Changed' } } }));
    expect(first.fileUrl).not.toBe(second.fileUrl);
    for (const [name, bytes] of storage.upload.mock.calls) {
      expect(name).toContain(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  });
  it('reuses the same content address on predownload retries', async () => {
    const order = { id: 'order', createdAt: '2026-10-26T12:00:00.000Z' };
    const first = await getPrintReadyFile({ id: 'order' }, file());
    const second = await getPrintReadyFile(order, file());
    expect(first.fileUrl).toBe(second.fileUrl);
    expect(first.fileSha256).toBe(second.fileSha256);
  });
  it('anchors date/time watermarks to submission time, not each polling request', async () => {
    const stamped = file({ printOptions: { pages: { range: '2' }, watermark: { enabled: true, type: 'date_time' } } });
    const order = { id: 'order', createdAt: '2026-10-26T12:00:00.000Z' };
    const first = await getPrintReadyFile(order, stamped);
    const second = await getPrintReadyFile(order, stamped);
    expect(first.fileSha256).toBe(second.fileSha256);
  });
});
