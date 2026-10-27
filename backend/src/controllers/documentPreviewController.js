import { createDocumentAccessLog } from "../db/repository.js";
import { generateId } from "../utils/generateCode.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  assertCanPreviewDocument,
  fetchDocumentBuffer,
  getSafeContentType,
  getPreviewDisposition
} from "../services/documentPreviewService.js";

// Helper to validate UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRequestIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

export const previewDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  if (!UUID_REGEX.test(documentId)) {
    return res.status(400).json({ success: false, message: "Invalid document ID format." });
  }

  const guestToken = req.headers["x-order-access-token"] || req.query.token;

  try {
    const context = await assertCanPreviewDocument({
      documentId,
      user: req.user,
      guestToken
    });

    const preferConverted = req.query.converted === 'true';
    // Keep pending conversion explicit; do not preview the original as a PDF.
    if (preferConverted && (!context.document.printReadyStoragePath || !context.document.printReadySha256)) {
      return res.status(425).json({ success: false, message: 'The verified converted PDF is not ready yet.' });
    }
    const isConverted = preferConverted && context.document.printReadyStoragePath;
    const targetStoragePath = isConverted 
      ? context.document.printReadyStoragePath 
      : context.document.storagePath;

    const buffer = await fetchDocumentBuffer({
      storagePath: targetStoragePath
    });

    const fileType = isConverted ? "application/pdf" : context.document.fileType;
    const fileName = isConverted 
      ? (context.document.fileName || "document").replace(/\.[^.]+$/, ".pdf") 
      : context.document.fileName;

    const safeMime = getSafeContentType(fileType, fileName);
    const disposition = getPreviewDisposition({ mode: "preview", fileName });

    await createDocumentAccessLog({
      id: generateId(),
      documentId: context.document.id,
      orderId: context.orderId,
      userId: req.user?.id || null,
      action: "preview_same_tab",
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || null
    });

    res.setHeader("Content-Type", safeMime);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to preview document." });
  }
});

export const downloadDocument = asyncHandler(async (req, res) => {
  // Downloads follow the same converted-artifact readiness rule as previews.
  const { documentId } = req.params;

  if (!UUID_REGEX.test(documentId)) {
    return res.status(400).json({ success: false, message: "Invalid document ID format." });
  }

  const guestToken = req.headers["x-order-access-token"] || req.query.token;

  try {
    const context = await assertCanPreviewDocument({
      documentId,
      user: req.user,
      guestToken
    });

    const preferConverted = req.query.converted === 'true';
    if (preferConverted && (!context.document.printReadyStoragePath || !context.document.printReadySha256)) {
      return res.status(425).json({ success: false, message: 'The verified converted PDF is not ready yet.' });
    }
    const isConverted = preferConverted && context.document.printReadyStoragePath;
    const targetStoragePath = isConverted 
      ? context.document.printReadyStoragePath 
      : context.document.storagePath;

    const buffer = await fetchDocumentBuffer({
      storagePath: targetStoragePath
    });

    const fileType = isConverted ? "application/pdf" : context.document.fileType;
    const fileName = isConverted 
      ? (context.document.fileName || "document").replace(/\.[^.]+$/, ".pdf") 
      : context.document.fileName;

    const safeMime = getSafeContentType(fileType, fileName);
    const disposition = getPreviewDisposition({ mode: "download", fileName });

    await createDocumentAccessLog({
      id: generateId(),
      documentId: context.document.id,
      orderId: context.orderId,
      userId: req.user?.id || null,
      action: "download_same_tab",
      ipAddress: getRequestIp(req),
      userAgent: req.headers["user-agent"] || null
    });

    res.setHeader("Content-Type", safeMime);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Failed to download document." });
  }
});
