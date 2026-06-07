import express from 'express';
import { getUserHistory } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/history', authMiddleware, roleMiddleware('user'), getUserHistory);

export default router;
