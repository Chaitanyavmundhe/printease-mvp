import { findDocumentAccessContext } from "../db/repository.js";
import { getSupabaseAdminClient, getSupabaseBucketName } from "../config/supabase.js";

// Max file size permitted to load into buffer (e.g. 50 MB)
const MAX_PREVIEW_SIZE_BYTES = 50 * 1024 * 1024;

export function getSafeContentType(fileType, fileName) {
  const type = (fileType || "").toLowerCase().trim();
  const ext = fileName ? fileName.split(".").pop().toLowerCase() : "";

  if (type === "application/pdf" || ext === "pdf") return "application/pdf";
  if (type === "image/jpeg" || type === "image/jpg" || ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (type === "image/png" || ext === "png") return "image/png";
  if (type === "image/webp" || ext === "webp") return "image/webp";
  if (type === "image/gif" || ext === "gif") return "image/gif";
  if (type === "text/plain" || ext === "txt") return "text/plain";
  if (type === "text/csv" || ext === "csv") return "text/csv";
  if (type === "application/json" || ext === "json") return "application/json";

  return "application/octet-stream";
}

export function getPreviewKind(fileType, fileName) {
  const safeType = getSafeContentType(fileType, fileName);
  if (safeType === "application/pdf") return "pdf";
  if (safeType.startsWith("image/")) return "image";
  if (safeType === "text/plain" || safeType === "text/csv" || safeType === "application/json") return "text";
  return "unsupported";
}

export function getPreviewDisposition({ mode, fileName }) {
  const safeName = encodeURIComponent(fileName || "document");
  if (mode === "download") {
    return `attachment; filename="${safeName}"`;
  }
  return `inline; filename="${safeName}"`;
}

export async function assertCanPreviewDocument({ documentId, user, guestToken }) {
  const context = await findDocumentAccessContext(documentId, user, guestToken);
  if (!context) {
    throw { status: 404, message: "Document not found" };
  }
  if (!context.allowed) {
    throw { status: 403, message: "You are not allowed to access this document" };
  }
  if (!context.document.storagePath) {
    throw { status: 404, message: "Document is not available in private storage" };
  }
  return context;
}

export async function fetchDocumentBuffer({ storagePath }) {
  const supabase = getSupabaseAdminClient();
  
  // Fetch metadata first to enforce size limit guard
  const { data: metadata, error: metaError } = await supabase.storage
    .from(getSupabaseBucketName())
    .getMetadata(storagePath);
    
  if (metaError) {
    throw { status: 502, message: metaError.message || "Failed to retrieve storage file metadata" };
  }

  const sizeBytes = metadata?.size || 0;
  if (sizeBytes > MAX_PREVIEW_SIZE_BYTES) {
    throw { status: 413, message: `File size exceeds the limit (${(MAX_PREVIEW_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB) for same-tab rendering.` };
  }

  const { data, error } = await supabase.storage
    .from(getSupabaseBucketName())
    .download(storagePath);

  if (error || !data) {
    throw { status: 502, message: error?.message || "Failed to retrieve document from Supabase storage" };
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
