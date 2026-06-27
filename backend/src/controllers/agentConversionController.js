import { getNextConversionJobForAgent, findDocumentById } from '../db/repository.js';
import { resolveDownloadUrl } from '../services/agentJobPayloadService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getNextConversionJob = asyncHandler(async (req, res) => {
  const hubId = req.agent.hubId;
  
  const document = await getNextConversionJobForAgent(hubId);

  if (!document) {
    return res.json({ success: true, job: null });
  }

  const signedFileUrl = await resolveDownloadUrl(document.fileUrl);

  return res.json({
    success: true,
    job: {
      documentId: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSha256: document.fileSha256,
      fileUrl: signedFileUrl,
      fileKind: document.fileKind,
      requiresDesktopPreparation: document.requiresDesktopPreparation
    }
  });
});
