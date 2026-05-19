import express from 'express';
import { createSignedDownload } from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/:documentId/signed-download', authMiddleware, createSignedDownload);

export default router;
