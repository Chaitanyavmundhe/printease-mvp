import express from 'express';
import { createSignedDownload } from '../controllers/documentController.js';
import { previewDocument, downloadDocument } from '../controllers/documentPreviewController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

router.post('/:documentId/signed-download', optionalAuthMiddleware, createSignedDownload);
router.get('/:documentId/preview', optionalAuthMiddleware, previewDocument);
router.get('/:documentId/download', optionalAuthMiddleware, downloadDocument);

export default router;
