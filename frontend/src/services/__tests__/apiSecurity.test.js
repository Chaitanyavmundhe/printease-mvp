import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';

beforeEach(() => { vi.resetModules(); localStorage.clear(); vi.stubGlobal('Blob', NodeBlob); });
afterEach(() => vi.unstubAllGlobals());

it('forwards the same capability for subsequent anonymous uploads', async () => {
  localStorage.setItem('printease_order_access_token', 'guest-capability');
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const { apiRequest } = await import('../api');
  await apiRequest('/api/uploads', { method: 'POST', body: new FormData() });
  expect(fetch.mock.calls[0][1].headers.get('x-order-access-token')).toBe('guest-capability');
  expect(fetch.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
});

it("does not return another account's cached private document", async () => {
  const fetch = vi.fn().mockImplementation(async url => String(url).includes('signed-download')
    ? new Response(JSON.stringify({ signedUrl: 'https://private-storage/document', document: { fileType: 'application/pdf' } }), { headers: { 'content-type': 'application/json' } })
    : new Response('%PDF-local-test', { headers: { 'content-type': 'application/pdf' } }));
  vi.stubGlobal('fetch', fetch);
  const { downloadDocumentBlob } = await import('../api');
  localStorage.setItem('printease_token', 'first-account');
  await downloadDocumentBlob('document-id');
  await downloadDocumentBlob('document-id');
  expect(fetch).toHaveBeenCalledTimes(2);
  localStorage.setItem('printease_token', 'second-account');
  await downloadDocumentBlob('document-id');
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('never caches an Office source as the converted PDF', async () => {
  const fetch = vi.fn().mockImplementation(async url => String(url).includes('signed-download')
    ? new Response(JSON.stringify({ signedUrl: 'https://private-storage/document' }), { headers: { 'content-type': 'application/json' } })
    : new Response('PK-not-a-pdf', { headers: { 'content-type': 'application/octet-stream' } }));
  vi.stubGlobal('fetch', fetch);
  const { downloadDocumentBlob } = await import('../api');
  await expect(downloadDocumentBlob('document-id', true)).rejects.toThrow(/not ready/);
  await expect(downloadDocumentBlob('document-id', true)).rejects.toThrow(/not ready/);
  expect(fetch).toHaveBeenCalledTimes(4);
});
