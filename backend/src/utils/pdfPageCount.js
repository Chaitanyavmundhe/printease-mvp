export async function getPdfPageCount(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid PDF buffer');
  }

  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const count = pdf.getPageCount();

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error('Could not determine PDF page count');
    }

    return count;
  } catch (error) {
    if (error.message === 'Could not determine PDF page count') {
      throw error;
    }

    throw new Error('Could not read PDF page count. Please upload a valid PDF.');
  }
}
