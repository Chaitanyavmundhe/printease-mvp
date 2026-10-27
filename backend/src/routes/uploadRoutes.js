import express from 'express';
import { uploadDocument, assignHub } from '../controllers/uploadController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';
import { withUploadCapacity } from '../middleware/uploadCapacity.js';

const router = express.Router();

router.post('/', uploadRateLimit, optionalAuthMiddleware, withUploadCapacity(upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'printReadyFile', maxCount: 1 }
]), uploadDocument));

router.put('/:documentId/assign-hub', optionalAuthMiddleware, assignHub);

export default router;
