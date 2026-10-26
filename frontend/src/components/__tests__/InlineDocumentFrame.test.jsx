import { expect, it, vi } from 'vitest';

vi.mock('react-pdf', () => ({ Document: () => null, Page: () => null, pdfjs: { version: '5.4.296', GlobalWorkerOptions: {} } }));

it('uses a bundled PDF worker, never a protocol-relative CDN URL', async () => {
  await import('../InlineDocumentFrame');
  const { pdfjs } = await import('react-pdf');
  expect(pdfjs.GlobalWorkerOptions.workerSrc).not.toMatch(/unpkg|^\/\//);
  expect(new URL(pdfjs.GlobalWorkerOptions.workerSrc, location.href).origin).toBe(location.origin);
  expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain('pdf.worker');
});
