import { getSupabaseAdminClient } from '../config/supabase.js';
import { OFFICIAL_BACKEND_URL } from '../config/agent.js';
import { findOrderByIdOrCode, listOrderFiles } from '../db/repository.js';
import { getPrintReadyFile } from '../utils/printReadyPdf.js';
import { optionsForDeliveredPdf } from './printJobReadinessService.js';

export function parsePrivateStorageReference(fileUrl) {
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

export async function resolveDownloadUrl(fileUrl) {
  const privateReference = parsePrivateStorageReference(fileUrl);

  if (!privateReference) {
    return fileUrl;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(privateReference.bucket)
    .createSignedUrl(privateReference.storagePath, 10 * 60);

  if (error || !data?.signedUrl) {
    const signedUrlError = new Error(error?.message || 'Could not create signed document URL');
    signedUrlError.statusCode = 502;
    throw signedUrlError;
  }

  return data.signedUrl;
}

export async function toAgentJobPayload(job) {
  if (!job) return null;

  const signedFileUrl = await resolveDownloadUrl(job.fileUrl);
  const [order, orderFiles] = await Promise.all([
    findOrderByIdOrCode(job.orderId),
    listOrderFiles(job.orderId)
  ]);

  const files = await Promise.all(orderFiles.map(async (file) => {
    const printReadyFile = await getPrintReadyFile(order, file);
    const fileUrl = printReadyFile?.fileUrl
      ? await resolveDownloadUrl(printReadyFile.fileUrl)
      : null;

    return {
      documentId: file.documentId,
      fileUrl,
      fileSha256: printReadyFile?.fileSha256 || file.document?.fileSha256,
      fileName: file.document?.fileName,
      fileType: printReadyFile?.fileType || file.document?.fileType,
      pageCount: file.originalPageCount,
      selectedPages: file.selectedPages,
      selectedPageCount: file.selectedPageCount,
      copies: file.copies,
      printOptions: optionsForDeliveredPdf(file.printOptions, printReadyFile?.transformed),
      printReady: Boolean(printReadyFile?.transformed)
    };
  })).then((items) => items.filter((file) => file.fileUrl));

  return {
    jobId: job.id,
    orderId: job.orderId,
    orderCode: order?.orderCode || null,
    hubId: job.hubId,
    agentId: job.agentId,
    sourceBackendUrl: OFFICIAL_BACKEND_URL,
    files,
    fileUrl: signedFileUrl,
    fileSha256: job.fileSha256,
    fileHash: job.fileSha256,
    fileType: job.fileType,
    copies: job.copies,
    paperSize: job.paperSize,
    colorMode: job.colorMode,
    printOptions: job.printOptions || files[0]?.printOptions || {},
    paymentVerified: true,
    approvedForPrint: true,
    printable: true,
    printerName: job.printerName || null,
    status: job.status,
    createdAt: job.createdAt
  };
}
