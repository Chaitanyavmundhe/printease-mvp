import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import DocumentPreviewModal from '../DocumentPreviewModal';
import { getDocumentPreviewBlob } from '../../services/api';

vi.mock('../../services/api', () => ({ getDocumentPreviewBlob: vi.fn() }));
vi.mock('../InlineDocumentFrame', () => ({ default: () => <div>PDF rendered</div> }));
vi.mock('../upload/FileSettingsPanel', () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:modal-test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const props = { isOpen: true, onClose: vi.fn(), documentId: 'doc-id', fetchConvertedPdf: true, previewKind: 'pdf', fileName: 'report.pdf' };

it('shows terminal errors instead of polling forever as if conversion were pending', async () => {
  getDocumentPreviewBlob.mockRejectedValue(Object.assign(new Error('Access denied'), { status: 403 }));
  render(<DocumentPreviewModal {...props} />);
  await waitFor(() => expect(screen.getByText(/Access denied/)).toBeTruthy());
  expect(screen.queryByText('Loading preview...')).toBeNull();
  expect(getDocumentPreviewBlob).toHaveBeenCalledTimes(1);
});

it('retries only pending conversion, then renders the resulting PDF', async () => {
  vi.useFakeTimers();
  getDocumentPreviewBlob.mockRejectedValueOnce(Object.assign(new Error('Pending'), { status: 425 })).mockResolvedValue(new Blob(['%PDF-test']));
  render(<DocumentPreviewModal {...props} />);
  await act(async () => {});
  expect(screen.getByText(/Preparing PDF preview/)).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(screen.getByText('PDF rendered')).toBeTruthy();
  expect(getDocumentPreviewBlob).toHaveBeenCalledTimes(2);
});

it('does not fetch a server document when the caller already supplies a local preview', async () => {
  render(<DocumentPreviewModal {...props} blobUrl="blob:local-preview" />);
  await act(async () => {});
  expect(getDocumentPreviewBlob).not.toHaveBeenCalled();
  expect(screen.getByText('PDF rendered')).toBeTruthy();
});

it('bounds pending preview reads and clears them when the modal closes', async () => {
  vi.useFakeTimers();
  getDocumentPreviewBlob.mockRejectedValue(Object.assign(new Error('Pending'), { status: 425 }));
  const { rerender } = render(<DocumentPreviewModal {...props} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(screen.getByText(/Try again shortly/)).toBeTruthy();
  const calls = getDocumentPreviewBlob.mock.calls.length;
  rerender(<DocumentPreviewModal {...props} isOpen={false} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(getDocumentPreviewBlob).toHaveBeenCalledTimes(calls);
});
