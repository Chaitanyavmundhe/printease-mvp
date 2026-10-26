const OFFICE_EXTENSION = /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i;
const OFFICE_MIME = /(?:officedocument|msword|ms-excel|ms-powerpoint|vnd\.oasis\.opendocument)/i;

// Preview selection is read-only: Office files reuse the backend-verified PDF;
// this must never upload, convert, price, collect payment or dispatch a print.
export function shouldPreviewConvertedPdf({ fileName = '', fileType = '', requiresDesktopPreparation = false, printReadyStoragePath, printReadySha256 } = {}) {
  if (String(fileType).toLowerCase() === 'application/pdf') return false;
  return Boolean(requiresDesktopPreparation || (printReadyStoragePath && printReadySha256)) || OFFICE_MIME.test(fileType) || OFFICE_EXTENSION.test(fileName);
}

export function getPreviewKind(fileType, fileName = '') {
  const type = String(fileType || '').toLowerCase().split(';')[0];
  if (type === 'application/pdf' || /\.pdf$/i.test(fileName)) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(fileName)) return 'image';
  if (type.startsWith('text/') || type === 'application/json' || /\.(txt|csv|json|log)$/i.test(fileName)) return 'text';
  return 'unsupported';
}

export function previewPdfName(fileName = 'Document') {
  return /\.[^.]+$/.test(fileName) ? fileName.replace(/\.[^.]+$/, '.pdf') : `${fileName}.pdf`;
}

export function isPreviewPending(error) {
  // Authentication, missing/expired files and network errors are not conversion.
  return error?.status === 425;
}
