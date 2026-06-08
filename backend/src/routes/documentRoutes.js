import express from 'express';
import { createSignedDownload, downloadDocumentFile } from '../controllers/documentController.js';
import { previewDocument, downloadDocument } from '../controllers/documentPreviewController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:documentId/signed-download', optionalAuthMiddleware, createSignedDownload);
router.get('/:documentId/download-legacy', optionalAuthMiddleware, downloadDocumentFile);
router.get('/:documentId/preview', optionalAuthMiddleware, previewDocument);
router.get('/:documentId/download', optionalAuthMiddleware, downloadDocument);

export default router;
