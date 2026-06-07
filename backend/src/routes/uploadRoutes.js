import express from 'express';
import { uploadDocument } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { uploadRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/', uploadRateLimit, authMiddleware, upload.single('document'), uploadDocument);

export default router;
