import express from 'express';
import { uploadDocument } from '../controllers/uploadController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', optionalAuthMiddleware, upload.single('document'), uploadDocument);

export default router;
