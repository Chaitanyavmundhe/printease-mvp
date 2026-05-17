import { createDocument } from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDocumentToStorage } from '../services/storageService.js';

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const documentId = generateId();
  const storedFile = await uploadDocumentToStorage({
    file: req.file,
    documentId
  });

  const document = await createDocument({
    id: documentId,
    userId: req.user?.id || null,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    fileUrl: storedFile.fileUrl,
    fileSha256: storedFile.fileSha256,
    storagePath: storedFile.storagePath,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded securely',
    document
  });
});
