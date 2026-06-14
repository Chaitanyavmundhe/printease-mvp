export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

export const PRINTABLE_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'application/json',
]);

export const DESKTOP_PREPARABLE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'application/json'
]);

export function isAllowedUploadMimeType(mimeType) {
  return ALLOWED_UPLOAD_MIME_TYPES.has(String(mimeType || '').toLowerCase());
}

export function formatAllowedUploadTypes() {
  return [...ALLOWED_UPLOAD_MIME_TYPES].join(', ');
}

export function isPrintableUploadMimeType(mimeType) {
  return PRINTABLE_UPLOAD_MIME_TYPES.has(String(mimeType || '').toLowerCase());
}

export function isDesktopPreparableMimeType(mimeType) {
  return DESKTOP_PREPARABLE_MIME_TYPES.has(String(mimeType || '').toLowerCase());
}
