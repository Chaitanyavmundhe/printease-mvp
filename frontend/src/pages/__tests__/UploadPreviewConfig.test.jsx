import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import UploadPage from '../UploadPage';

vi.mock('../../hooks/useAutoUploadPreparation', () => ({ useAutoUploadPreparation: () => ({ uploadedDocuments: [] }) }));
vi.mock('../../utils/filePreparation/prepareUploadPreview', () => ({
  PREPARATION_STATUS: { READY: 'ready', PREPARING: 'preparing', FAILED: 'failed', PENDING_DESKTOP: 'pending_desktop' },
  prepareUploadPreview: vi.fn(async () => ({ status: 'ready', pageCount: 2, previewKind: 'pdf', previewPdfUrl: 'blob:prepared-pdf' })),
  revokePreparationPreview: vi.fn(),
}));
vi.mock('../../components/DocumentPreviewModal', () => ({
  default: ({ fileName, config, onChangeConfig }) => <section>
    <span>{fileName}: copies {config.copies}</span>
    <button onClick={() => onChangeConfig('copies', 7)}>Change preview copies</button>
  </section>
}));
afterEach(cleanup);

function Harness() {
  const [files, setFiles] = useState([]);
  const [documentFile, setDocumentFile] = useState(null);
  const [configs, setConfigs] = useState({});
  const setters = Object.fromEntries(['DocumentName', 'Pages', 'SelectedPages', 'Copies', 'ColorType', 'SideType', 'PaperSize', 'PagesPerSheet', 'Orientation', 'PrintDpi', 'ScaleMode', 'MarginMode', 'Watermark', 'WatermarkType', 'WatermarkText', 'WatermarkPosition', 'WatermarkOpacity', 'WatermarkFontSize', 'WatermarkRotation', 'BackendPrice'].map(name => ['set' + name, vi.fn()]));
  return <>
    <UploadPage {...setters} documentFile={documentFile} setDocumentFile={setDocumentFile}
      documentFiles={files} setDocumentFiles={setFiles} multiFileConfigs={configs} setMultiFileConfigs={setConfigs}
      currentUser={{ id: 'user' }} selectedCentre={{ id: 'hub', bwSingle: 2, bwDouble: 2, colorSingle: 5, colorDouble: 5 }}
      pages={2} selectedPages="all" copies={1} colorType="bw" sideType="single" paperSize="A4" pagesPerSheet={1}
      orientation="portrait" printDpi={300} scaleMode="fit" marginMode="default" watermark={false}
      estimatedSelectedPageCount={2} totalAmount={4} preparePayment={vi.fn()} navigate={vi.fn()} />
    <output data-testid="configs">{JSON.stringify(configs)}</output>
  </>;
}

it('keeps ready-preview changes attached to the second file, not an undefined key', async () => {
  const { container } = render(<Harness />);
  const files = ['first.pdf', 'second.pdf'].map(name => new File(['%PDF-test'], name, { type: 'application/pdf' }));
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preview second.pdf' })).toBeTruthy());
  await new Promise(resolve => setTimeout(resolve, 60));
  fireEvent.click(screen.getByRole('button', { name: 'Preview second.pdf' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change preview copies' }));
  const configs = JSON.parse(screen.getByTestId('configs').textContent);
  expect(configs[1].copies).toBe(7);
  expect(configs[0].copies).toBe(1);
  expect(configs.undefined).toBeUndefined();
});
