import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4 = {
  width: 595.28,
  height: 841.89
};

const PAGE_MARGIN = 48;

function wrapText(text, font, fontSize, maxWidth) {
  const words = String(text || '').replace(/\t/g, '  ').split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

async function buildImagePdf(sourceBytes, mimeType) {
  const pdfDoc = await PDFDocument.create();
  const image = mimeType === 'image/png'
    ? await pdfDoc.embedPng(sourceBytes)
    : await pdfDoc.embedJpg(sourceBytes);
  const page = pdfDoc.addPage([A4.width, A4.height]);
  const maxWidth = A4.width - PAGE_MARGIN * 2;
  const maxHeight = A4.height - PAGE_MARGIN * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    x: (A4.width - width) / 2,
    y: (A4.height - height) / 2,
    width,
    height
  });

  return pdfDoc.save();
}

async function buildTextPdf(sourceBytes, fileName = 'document.txt') {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontSize = 10;
  const lineHeight = 14;
  const maxWidth = A4.width - PAGE_MARGIN * 2;
  const maxLines = Math.floor((A4.height - PAGE_MARGIN * 2) / lineHeight);
  const decoded = Buffer.from(sourceBytes).toString('utf8').replace(/\r\n/g, '\n');
  const sourceLines = decoded.split('\n').flatMap((line) => wrapText(line, font, fontSize, maxWidth));

  let page = pdfDoc.addPage([A4.width, A4.height]);
  let y = A4.height - PAGE_MARGIN;
  let lineIndex = 0;

  page.drawText(fileName, {
    x: PAGE_MARGIN,
    y,
    size: 11,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= lineHeight * 1.5;

  for (const line of sourceLines) {
    if (lineIndex >= maxLines) {
      page = pdfDoc.addPage([A4.width, A4.height]);
      y = A4.height - PAGE_MARGIN;
      lineIndex = 0;
    }

    page.drawText(line.slice(0, 500), {
      x: PAGE_MARGIN,
      y,
      size: fontSize,
      font,
      color: rgb(0.12, 0.14, 0.18)
    });
    y -= lineHeight;
    lineIndex += 1;
  }

  return pdfDoc.save();
}

export async function convertPrintableUploadToPdf(sourceBytes, orderFile) {
  const enableBackendConversion = process.env.ENABLE_BACKEND_NON_PDF_CONVERSION === 'true';
  if (!enableBackendConversion) {
    const error = new Error('Backend non-PDF conversion is disabled by policy.');
    error.statusCode = 415;
    throw error;
  }

  const fileType = String(orderFile.document?.fileType || 'application/pdf').toLowerCase();

  if (fileType === 'image/jpeg') {
    return buildImagePdf(sourceBytes, fileType);
  }

  if (fileType === 'image/png') {
    return buildImagePdf(sourceBytes, fileType);
  }

  if (['text/plain', 'text/csv', 'application/json'].includes(fileType)) {
    return buildTextPdf(sourceBytes, orderFile.document?.fileName || 'document.txt');
  }

  const error = new Error('This file type can be uploaded, but cannot be auto-printed yet.');
  error.statusCode = 415;
  throw error;
}
