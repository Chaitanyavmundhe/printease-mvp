export async function getPdfPageCount(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid PDF buffer');
  }

  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(buffer);
    const count = pdf.getPageCount();

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error('Could not determine PDF page count');
    }

    return count;
  } catch (error) {
    const message = String(error?.message || '');

    if (message.toLowerCase().includes('encrypted')) {
      throw new Error('Password-protected PDFs are not supported. Please upload an unlocked PDF.');
    }

    if (error.message === 'Could not determine PDF page count') {
      throw error;
    }

    throw new Error('Could not read PDF page count. Please upload a valid, uncorrupted PDF.');
  }
}
