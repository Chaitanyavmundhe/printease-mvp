// A retry may confirm an existing artifact, never replace the bytes or trusted
// page count of a prepared document shared with paid orders and print jobs.
export function assertPreparationReportCanReplace(document, report) {
  if (document.preparationStatus !== 'prepared') return true;
  const expectedHash = document.printReadySha256 || document.fileSha256;
  if (report.preparationStatus !== 'prepared' ||
      (report.printReadySha256 && report.printReadySha256 !== expectedHash)) {
    const error = new Error('This document is already verified. Upload a new document to replace it.');
    error.statusCode = 409;
    throw error;
  }
  return false;
}
