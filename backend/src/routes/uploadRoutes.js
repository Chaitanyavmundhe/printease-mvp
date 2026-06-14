import express from 'express';
import { uploadDocument } from '../controllers/uploadController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/', uploadRateLimit, optionalAuthMiddleware, upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'printReadyFile', maxCount: 1 }
]), uploadDocument);

export default router;
