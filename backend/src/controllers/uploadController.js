import { createDocument } from '../db/repository.js';
import { generateId } from '../utils/generateCode.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const document = await createDocument({
    id: generateId(),
    userId: req.user?.id || null,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    fileUrl: `mock://uploads/${req.file.originalname}`,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Document uploaded in demo memory mode',
    document,
    note: 'Production should upload file to Supabase Storage or Cloudinary.'
  });
});
