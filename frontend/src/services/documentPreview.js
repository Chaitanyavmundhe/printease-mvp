import { getDocumentPreviewBlob } from './api';
import { getPreviewKind, previewPdfName, shouldPreviewConvertedPdf } from '../utils/documentPreview';

export async function loadDocumentPreview(document) {
  const converted = shouldPreviewConvertedPdf(document);
  const blob = await getDocumentPreviewBlob(document.documentId || document.id, converted);
  const name = converted ? previewPdfName(document.fileName) : document.fileName || 'Document';
  const fileType = converted ? 'application/pdf' : blob.type || document.fileType || '';
  const kind = getPreviewKind(fileType, name);
  return { blob, name, fileType, kind, textContent: kind === 'text' ? await blob.text() : '' };
}
