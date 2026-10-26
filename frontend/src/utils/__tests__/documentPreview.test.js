import { expect, it } from 'vitest';
import { getPreviewKind, isPreviewPending, shouldPreviewConvertedPdf } from '../documentPreview';

it.each(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'])('uses converted PDF for %s without relying on MIME metadata', extension => {
  expect(shouldPreviewConvertedPdf({ fileName: `report.${extension}`, fileType: 'application/octet-stream' })).toBe(true);
});
it('leaves original PDF, image and text previews direct', () => {
  for (const [fileName, fileType] of [['report.pdf', 'application/pdf'], ['image.png', 'image/png'], ['notes.txt', 'text/plain']]) {
    expect(shouldPreviewConvertedPdf({ fileName, fileType })).toBe(false);
    expect(getPreviewKind(fileType, fileName)).not.toBe('unsupported');
  }
});
it('only treats an explicit backend pending response as conversion in progress', () => {
  expect(isPreviewPending({ status: 425 })).toBe(true);
  for (const status of [0, 401, 403, 404, 500, 502]) expect(isPreviewPending({ status })).toBe(false);
});

it('also uses a verified converted artifact for non-Office files when metadata identifies one', () => {
  expect(shouldPreviewConvertedPdf({ fileName: 'scan.tiff', requiresDesktopPreparation: true })).toBe(true);
  expect(shouldPreviewConvertedPdf({ fileName: 'notes.txt', printReadyStoragePath: 'private/path.pdf', printReadySha256: 'verified-hash' })).toBe(true);
});
