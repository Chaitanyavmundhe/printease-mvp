import crypto from 'crypto';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { getSupabaseAdminClient, getSupabaseBucketName } from '../config/supabase.js';
import { parsePageRange } from './printOptions.js';
import { isPrintableUploadMimeType } from '../constants/upload.js';
import { convertPrintableUploadToPdf } from './printablePdfConversion.js';

function parsePrivateStorageReference(fileUrl) {
  if (!String(fileUrl || '').startsWith('private://')) {
    return null;
  }

  const withoutProtocol = String(fileUrl).slice('private://'.length);
  const separatorIndex = withoutProtocol.indexOf('/');

  if (separatorIndex === -1) {
    return null;
  }

  return {
    bucket: withoutProtocol.slice(0, separatorIndex),
    storagePath: withoutProtocol.slice(separatorIndex + 1)
  };
}

function selectedPageNumbers(orderFile) {
  const totalPages = Number(orderFile.originalPageCount || orderFile.document?.pageCount || 0);
  const options = orderFile.printOptions || {};
  const selected = Array.isArray(options.pages?.selected) ? options.pages.selected : null;

  if (selected?.length) {
    return selected.map((page) => Number(page)).filter((page) => Number.isInteger(page) && page >= 1 && page <= totalPages);
  }

  return parsePageRange(options.pages?.range || orderFile.selectedPages || '', totalPages);
}

function needsPrintReadyPdf(orderFile) {
  const options = orderFile.printOptions || {};
  const isPreConverted = Boolean(orderFile.document?.printReadyStoragePath);
  const fileType = isPreConverted ? 'application/pdf' : String(orderFile.document?.fileType || 'application/pdf').toLowerCase();
  
  if (fileType !== 'application/pdf') {
    const enableBackendConversion = process.env.ENABLE_BACKEND_NON_PDF_CONVERSION === 'true';
    if (!enableBackendConversion) return false;
    return isPrintableUploadMimeType(fileType);
  }

  const totalPages = Number(orderFile.originalPageCount || orderFile.document?.pageCount || 0);
  const selectedCount = Number(orderFile.selectedPageCount || 0);
  const hasPageSubset = selectedCount > 0 && totalPages > 0 && selectedCount < totalPages;

  return Boolean(hasPageSubset || options.watermark?.enabled);
}

function watermarkText(order, orderFile) {
  const watermark = orderFile.printOptions?.watermark || {};
  if (watermark.type === 'custom_text' && watermark.text) return watermark.text;
  if (watermark.type === 'pickup_code' && order?.pickupCode) return `Pickup ${order.pickupCode}`;
  if (watermark.type === 'date_time') return new Date().toLocaleString('en-IN');
  return order?.orderCode ? `Order ${order.orderCode}` : 'PrintEase';
}

function watermarkPosition(position, pageWidth, pageHeight, textWidth, fontSize) {
  const margin = 24;
  const positions = {
    top_left: [margin, pageHeight - margin - fontSize],
    top_center: [(pageWidth - textWidth) / 2, pageHeight - margin - fontSize],
    top_right: [pageWidth - textWidth - margin, pageHeight - margin - fontSize],
    center: [(pageWidth - textWidth) / 2, (pageHeight - fontSize) / 2],
    bottom_left: [margin, margin],
    bottom_center: [(pageWidth - textWidth) / 2, margin],
    bottom_right: [pageWidth - textWidth - margin, margin]
  };

  return positions[position] || positions.bottom_right;
}

async function buildPrintReadyPdf(sourceBytes, order, orderFile) {
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const targetPdf = await PDFDocument.create();
  const totalPages = sourcePdf.getPageCount();
  const selectedPages = selectedPageNumbers({
    ...orderFile,
    originalPageCount: orderFile.originalPageCount || totalPages
  });
  const copiedPages = await targetPdf.copyPages(sourcePdf, selectedPages.map((page) => page - 1));

  copiedPages.forEach((page) => targetPdf.addPage(page));

  const watermark = orderFile.printOptions?.watermark || {};
  if (watermark.enabled) {
    const font = await targetPdf.embedFont(StandardFonts.HelveticaBold);
    const text = watermarkText(order, orderFile);
    const fontSize = Number(watermark.fontSize) || 18;
    const opacity = Math.max(0.05, Math.min(Number(watermark.opacity) || 0.18, 0.6));

    for (const page of targetPdf.getPages()) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const [x, y] = watermarkPosition(watermark.position, width, height, textWidth, fontSize);

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.18, 0.23),
        opacity,
        rotate: degrees(Number(watermark.rotation) || 0)
      });
    }
  }

  return targetPdf.save();
}

async function buildPrintablePdf(sourceBytes, order, orderFile) {
  const fileType = String(orderFile.document?.fileType || 'application/pdf').toLowerCase();

  if (fileType === 'application/pdf') {
    return buildPrintReadyPdf(sourceBytes, order, orderFile);
  }

  return convertPrintableUploadToPdf(sourceBytes, orderFile);
}

export async function getPrintReadyFile(order, orderFile) {
  const privateReference = parsePrivateStorageReference(orderFile.document?.fileUrl);
  const bucket = privateReference?.bucket || getSupabaseBucketName();
  const sourcePath = orderFile.document?.printReadyStoragePath || privateReference?.storagePath || orderFile.document?.storagePath;
  const isPreConverted = Boolean(orderFile.document?.printReadyStoragePath);

  if (!sourcePath) {
    return null;
  }

  const sourceType = isPreConverted ? 'application/pdf' : (orderFile.document?.fileType || 'application/pdf');

  if (!isPrintableUploadMimeType(sourceType)) {
    return null;
  }

  if (!needsPrintReadyPdf(orderFile)) {
    return {
      fileUrl: `private://${bucket}/${sourcePath}`,
      fileSha256: orderFile.document?.printReadySha256 || orderFile.document?.fileSha256,
      fileType: sourceType,
      transformed: isPreConverted
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).download(sourcePath);

  if (error || !data) {
    const downloadError = new Error(error?.message || 'Could not download source PDF for print-ready transformation');
    downloadError.statusCode = 502;
    throw downloadError;
  }

  const sourceBytes = new Uint8Array(await data.arrayBuffer());
  const outputBytes = await buildPrintablePdf(sourceBytes, order, orderFile);
  const outputBuffer = Buffer.from(outputBytes);
  const outputSha256 = crypto.createHash('sha256').update(outputBuffer).digest('hex');
  const outputPath = `print-ready/${orderFile.orderId}/${orderFile.id}.pdf`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(outputPath, outputBuffer, {
    contentType: 'application/pdf',
    upsert: true
  });

  if (uploadError) {
    const printReadyError = new Error(uploadError.message || 'Could not store print-ready PDF');
    printReadyError.statusCode = 502;
    throw printReadyError;
  }

  return {
    fileUrl: `private://${bucket}/${outputPath}`,
    fileSha256: outputSha256,
    fileType: 'application/pdf',
    transformed: true
  };
}
