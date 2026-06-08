export async function getPdfPageCount(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid PDF buffer');
  }

  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfPromise = PDFDocument.load(buffer);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF parsing timed out')), 10000);
    });
    
    const pdf = await Promise.race([pdfPromise, timeoutPromise]);
    const count = pdf.getPageCount();

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error('Could not determine PDF page count');
    }

    return count;
  } catch (error) {
    const message = String(error?.message || '');

    if (message.includes('PDF parsing timed out')) {
      throw new Error('PDF parsing timed out. The file may be too complex or malicious.');
    }

    if (message.toLowerCase().includes('encrypted')) {
      throw new Error('Password-protected PDFs are not supported. Please upload an unlocked PDF.');
    }

    if (error.message === 'Could not determine PDF page count') {
      throw error;
    }

    throw new Error('Could not read PDF page count. Please upload a valid, uncorrupted PDF.');
  }
}
