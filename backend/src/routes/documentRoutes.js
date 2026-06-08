import express from 'express';
import { createSignedDownload, downloadDocumentFile } from '../controllers/documentController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:documentId/signed-download', optionalAuthMiddleware, createSignedDownload);
router.get('/:documentId/download', optionalAuthMiddleware, downloadDocumentFile);

export default router;
