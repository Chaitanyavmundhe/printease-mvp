import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { useDocumentPreview } from '../useDocumentPreview';
import { getDocumentPreviewBlob } from '../../services/api';

vi.mock('../../services/api', () => ({ getDocumentPreviewBlob: vi.fn(), getDocumentDownloadBlob: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('Blob', NodeBlob);
  URL.createObjectURL = vi.fn(() => 'blob:preview-test');
  URL.revokeObjectURL = vi.fn();
  getDocumentPreviewBlob.mockResolvedValue(new NodeBlob(['%PDF-test'], { type: 'application/pdf' }));
});
afterEach(() => vi.unstubAllGlobals());

it('requests the verified converted PDF for an Office document', async () => {
  const { result } = renderHook(() => useDocumentPreview());
  await act(() => result.current.openPreview('doc-id', 'proposal.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 42));
  expect(getDocumentPreviewBlob).toHaveBeenCalledWith('doc-id', true);
  expect(result.current.previewKind).toBe('pdf');
  expect(result.current.fileName).toBe('proposal.pdf');
});

it('previews an original PDF without asking for conversion', async () => {
  const { result } = renderHook(() => useDocumentPreview());
  await act(() => result.current.openPreview('pdf-id', 'original.pdf', 'application/pdf', 42));
  expect(getDocumentPreviewBlob).toHaveBeenCalledWith('pdf-id', false);
});

it('does not reopen a preview when its request finishes after closing', async () => {
  let resolve;
  getDocumentPreviewBlob.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useDocumentPreview());
  let request;
  act(() => { request = result.current.openPreview('doc-id', 'file.pdf', 'application/pdf'); });
  act(() => result.current.closePreview());
  await act(async () => { resolve(new NodeBlob(['%PDF-test'], { type: 'application/pdf' })); await request; });
  expect(result.current.blobUrl).toBeNull();
  expect(result.current.loading).toBe(false);
});
