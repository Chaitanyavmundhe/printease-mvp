import express from 'express';
import { createSignedDownload } from '../controllers/documentController.js';
import { optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:documentId/signed-download', optionalAuthMiddleware, createSignedDownload);

export default router;
