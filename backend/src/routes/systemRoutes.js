import express from 'express';
import { cleanupOldData } from '../controllers/systemController.js';

const router = express.Router();

router.post('/cleanup', cleanupOldData);

export default router;
