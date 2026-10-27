import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';

it.each(['history', 'detail'])('isolates cached %s across login and guest identities', async kind => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    orders: [{ id: localStorage.getItem('printease_token') || localStorage.getItem('printease_order_access_token') }],
    order: { id: localStorage.getItem('printease_token') || localStorage.getItem('printease_order_access_token') },
  }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const api = await import('../api');
  const read = () => kind === 'history' ? api.getUserHistory() : api.getOrderDetail('same-order');
  for (const identity of ['account-a', 'account-b', null]) {
    if (identity) localStorage.setItem('printease_token', identity);
    else localStorage.removeItem('printease_token');
    localStorage.setItem('printease_order_access_token', 'guest-one');
    const data = await read();
    expect(kind === 'history' ? data.orders[0].id : data.id).toBe(identity || 'guest-one');
    await read();
  }
  expect(fetch).toHaveBeenCalledTimes(3);
  localStorage.setItem('printease_order_access_token', 'guest-two');
  const data = await read();
  expect(kind === 'history' ? data.orders[0].id : data.id).toBe('guest-two');
  expect(fetch).toHaveBeenCalledTimes(4);
});

it.each(['history', 'detail', 'blob'])('rejects late private %s after logout without a second request', async kind => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const fetch = vi.fn().mockReturnValue(pending);
  vi.stubGlobal('fetch', fetch);
  const api = await import('../api');
  localStorage.setItem('printease_token', 'account-a');
  const request = kind === 'history' ? api.getUserHistory()
    : kind === 'detail' ? api.getOrderDetail('private-order') : api.downloadDocumentBlob('private-doc');
  const rejected = expect(request).rejects.toMatchObject({ status: 401 });
  localStorage.removeItem('printease_token');
  if (kind === 'blob') {
    fetch.mockResolvedValue(new Response('%PDF-private'));
    release(new Response(JSON.stringify({ signedUrl: 'https://private-storage/document' }), { headers: { 'content-type': 'application/json' } }));
  } else {
    release(new Response(JSON.stringify({ orders: [], order: { id: 'private-order' } }), { headers: { 'content-type': 'application/json' } }));
  }
  await rejected;
});

it('invalidates private history and detail in the current credential scope', async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ orders: [], order: {} }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  const api = await import('../api');
  localStorage.setItem('printease_token', 'account-a');
  await api.getUserHistory({ userId: 'a' });
  await api.getOrderDetail('one');
  api.invalidateUserHistory('a');
  api.invalidateOrderDetail('one');
  await api.getUserHistory({ userId: 'a' });
  await api.getOrderDetail('one');
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('includes guest capability changes even while a login token is present', async () => {
  const fetch = vi.fn().mockImplementation(async url => String(url).includes('signed-download')
    ? new Response(JSON.stringify({ signedUrl: 'https://private-storage/document' }), { headers: { 'content-type': 'application/json' } })
    : new Response('%PDF-private'));
  vi.stubGlobal('fetch', fetch);
  const api = await import('../api');
  localStorage.setItem('printease_token', 'account-a');
  localStorage.setItem('printease_order_access_token', 'guest-one');
  await api.downloadDocumentBlob('same-doc');
  localStorage.setItem('printease_order_access_token', 'guest-two');
  await api.downloadDocumentBlob('same-doc');
  expect(fetch).toHaveBeenCalledTimes(4);
});


beforeEach(() => { vi.resetModules(); localStorage.clear(); vi.stubGlobal('Blob', NodeBlob); });
afterEach(() => { vi.unstubAllGlobals(); delete window.printeaseDesktop; });

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

it.each([true, false])('uses the desktop cached PDF only when its hash matches the authorized artifact (match=%s)', async matches => {
  vi.stubGlobal('crypto', webcrypto);
  const content = '%PDF-verified-conversion';
  const sha256 = createHash('sha256').update(content).digest('hex');
  window.printeaseDesktop = { getCachedDocumentUrl: vi.fn().mockResolvedValue({ success: true, url: 'app://printease/cache/document-id' }) };
  const fetch = vi.fn().mockImplementation(async url => {
    if (String(url).includes('signed-download')) return new Response(JSON.stringify({ signedUrl: 'https://private-storage/converted.pdf', document: { fileType: 'application/pdf', fileSha256: sha256 } }), { headers: { 'content-type': 'application/json' } });
    if (String(url).startsWith('app:')) return new Response(matches ? content : 'PK-original-office-file');
    return new Response(content, { headers: { 'content-type': 'application/pdf' } });
  });
  vi.stubGlobal('fetch', fetch);
  const { getDocumentPreviewBlob } = await import('../api');
  const blob = await getDocumentPreviewBlob('document-id', true);
  expect(await blob.text()).toBe(content);
  expect(fetch.mock.calls[0][0]).toContain('signed-download?converted=true');
  expect(fetch).toHaveBeenCalledTimes(matches ? 2 : 3);
});
